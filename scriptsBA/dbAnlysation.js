var q       = require('q')
var format  = require('string-format')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')

var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*'

var elasticClient = new esearch.Client({
    host: config.database.dep_host + ':' + config.database.port
})

elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        getDemandingCompanies()

    }
})

function getDemandingCompanies(){
    elasticClient.search({
        index: company + allPostsIndex,
        type: "post",
        body:{}
    }).then(function(result){
        console.log()
    })
}