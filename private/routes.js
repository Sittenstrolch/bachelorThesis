'use strict';
var config               = require('../config.js'),
    graphHandler         = require('./graphHandler.js')

module.exports = function(app) {

  /**
    *  GET: :return_to - either 'register' or 'settings'
    */
  app.route('/api/endpoint')
    .get(function(req, res) {

    })
    .post(function(req, res){

    })

  app.route('/api/graph')
      .get(graphHandler.graph)

  app.route('/api/clusters')
      .get(graphHandler.clusters)

  //QS: id : companyid
  app.route("/api/links")
      .get(graphHandler.linksForCompany)

  app.route("/api/posts")
      .get(graphHandler.getPosts)

  /**
  * GET: redirect all requests with path not starting with api or # to the same link with #
  */

  app.route('/*')
      .get(function(req, res) {
        var querystring = "?"
        for(var key in req.query){
          querystring += "key="+req.query[key]+"&"
        }
        res.writeHead(301, {'Location': config.url +'/index.html#' + req.originalUrl + querystring})
        res.end()

      })

}