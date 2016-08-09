var express = require('express');
var router = express.Router();
var Project = require('./models/models').Project;
var Master = require('./models/models').Master;
var Tag = require('./models/models').Tag;
var rp = require('request-promise');
var findOrCreate = require('mongoose-findorcreate')
var Handlebars = require('handlebars')

module.exports = {
  body: null,
  project: null,
  findMaster: function(project) {
    this.project = project;
    return Master.find({})
  },
  createTag: function(masters) {
    //storing all masters
    this.masters = masters;
    var fields = [];
    var master = masters.filter(function(item) {
      return item.name === this.body.type
    }.bind(this))[0];
    for(var i = 0; i < master.tokens.length; i++) {
      fields.push({'name': master.tokens[i]['tokenName'], 'description': master.tokens[i]['description'], 'value': this.body[master.tokens[i]['tokenName']]})
    }
    t = new Tag({
      name: master.name,
      fields: fields,
      tagDescription: master.tagDescription,
      trackingTrigger: this.body.trackingTrigger,
      custom: this.body.custom,
      projectId: this.project.projectId,
      active: this.body.active,
      hasCallback: master.hasCallback,
      pageName: this.body.pageName,
      eventName: this.body.eventName
    })
    return t.save()
  },
  updateProject: function(tag) {
    this.project.tags.push(tag._id);
    return new Promise(function(resolve, reject) {
      if(tag.trackingTrigger !== "onDocumentReady" && tag.trackingTrigger !== "inHeader" && tag.trackingTrigger !== "onPageLoad" && tag.trackingTrigger !== "onEvent") {
        Tag.findOne({"name": tag.trackingTrigger})
           .then(function(trackerTag) {
              trackerTag.callbacks.push(tag.name)
              return trackerTag.save()
            }.bind(this))
           .then(()=>resolve(this.project.save()))
           .catch(err=>reject(err))
      }
      else {
        resolve(this.project.save())
        }
      }.bind(this))
  },
  populateProject: function(updatedProject) {
    return updatedProject.populate({path: 'tags'}).execPopulate()
  },
  getJavascript: function(populatedProject) {
    var tags = this.project.tags;

//do everything separately

    //wrap page type things
    var inHeaders = tags.filter(function(item){
                    return item.trackingTrigger === "inHeader";
                  })
    var onDocumentReadys = tags.filter(function(item){
                              return item.trackingTrigger === "onDocumentReady";
                            })
    var onPageLoads = tags.filter(function(item) {
                                  return item.trackingTrigger === "onPageLoad"
                              })
    var onEvents = tags.filter(function(item) {
                                  return item.trackingTrigger === "onEvent"
                                })

    var inHeaderJavascript = '';
    for(var i = 0; i < inHeaders.length; i++) {
      //call render for each inHeader
      inHeaderJavascript = inHeaders[i].render(tags, this.masters);
    }
    var onDocumentReadyJavascript = '';
    for(var i = 0; i < onDocumentReadys.length; i++) {
      //TODO: wrap this in onDocumentReady here, not in function
      onDocumentReadyJavascript = onDocumentReadys[i].render(tags, this.masters);
    }
    var pagesToIds = {'select_dropdown_1': "6824293401", "shopping_cart": "6824330423"}



    //get all pages call
    var onEventsObject = {};
    var marker = false;
    for(var i = 0; i < onEvents.length; i++) {
      marker = true;
      onEventsObject[onEvents[i].eventName] = onEvents[i].render(tags, this.masters);
    }

    onEventsObjectString = JSON.stringify(onEventsObject);
    onEventsObjectString = "var onEventsObjectFunction = function() {return " + onEventsObjectString + ";};"

    var onSpecificEventJavascript = '';
    if (marker) {
      onSpecificEventJavascript = "window.optimizely.push({type: 'addListener',filter: {type: 'analytics',name: 'trackEvent',},handler: function(data) {console.log('Page', data.name, 'was activated.');eval(onEventsObjectFunction()[data.id]);}});"
    }
    //wrap onDocumentReadyJavascript in an on document ready
    onDocumentReadyJavascript = '$(document).ready(function(){' +onDocumentReadyJavascript+ '});'

    //combine inHeaders and onDocumentReadys
    this.combinedJavascript = onEventsObjectString + inHeaderJavascript + onDocumentReadyJavascript + onSpecificEventJavascript;

    //getting original Javascript sections
    var token = process.env.API_TOKEN;
    return rp({
                     uri: "https://www.optimizelyapis.com/experiment/v1/projects/" + this.project.projectId,
                     method: 'GET',
                     headers: {
                       "Token": token,
                       "Content-Type": "application/json"
                     }
     })
  },
  buildJavascript: function(response) {
    var j = JSON.parse(response).project_javascript;


    //get start section
    originalJavascriptStartSectionIndex = j.indexOf('//--------------------HorizonsJavascriptStart--------------------');
    var originalJavascriptStartSection = ''
    if (originalJavascriptStartSectionIndex !== -1) {
      originalJavascriptStartSection = j.slice(0, originalJavascriptStartSectionIndex);
    }

    //TODO: getEndSection
    originalJavascriptEndSectionIndex = j.indexOf('\n//--------------------HorizonsJavascriptEnd--------------------') + 64;
    var originalJavascriptEndSection = '';
    if (originalJavascriptEndSectionIndex !== -1) {
      originalJavascriptEndSection = j.slice(originalJavascriptEndSectionIndex)
    }

    //add our javascript piece to the originalJavascriptStartSection
    var finalJavascript = originalJavascriptStartSection + "//--------------------HorizonsJavascriptStart--------------------\n" + this.combinedJavascript + '\n//--------------------HorizonsJavascriptEnd--------------------' + originalJavascriptEndSection;
    var token = process.env.API_TOKEN;
    return rp({
         uri: "https://www.optimizelyapis.com/experiment/v1/projects/" + this.project.projectId,
         method: 'PUT',
         json: {
           include_jquery: true,
           project_javascript: finalJavascript},
         headers: {
           "Token": token,
           "Content-Type": "application/json"
         }
       })
  },
  getTagOptions: function(project) {
    this.project = project;
    return Tag.find({'hasCallback': true});
  },
  getOptions: function(tags) {
        //get names of options
        this.tagNames = tags.map(function(item) {
          return item.name;
        });

        //inHeader/onDocumentReady should intuitively come first
        this.tagNames.unshift("inHeader");
        this.tagNames.unshift("onDocumentReady");

        //save current tags
        this.tags = tags;

        //make call to optimizely for all pages associated with the id
        var token = process.env.API_TOKEN;
        return rp({
             uri: "https://www.optimizelyapis.com/v2/events?project_id=" + 6668600890,
             method: 'GET',
             headers: {
               "Token": token,
               "Content-Type": "application/json"
             }
           })

        //send info
        //res.setHeader('Content-Type', 'application/json');
        //res.send(JSON.stringify(tags));
  },
  addProjectOptions: function(data) {
    console.log("TAGS", this.tagNames)
    console.log("DATA", data)
    var eventNames = JSON.parse(data).map(function(item) {
      return item.api_name;
    })
    return this.tagNames.concat(eventNames);
  },
  approve: function(master) {
    //change approved to true
    master.approved = true;
    return master.save();
  }
}
