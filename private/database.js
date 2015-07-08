var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch'),
    fs                   = require('fs')

var elasticClient = new esearch.Client({
    host: config.database.dev_host + ':' + config.database.port
})

elasticClient.ping({
    requestTimeout: 1000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster Dev is down!');
    } else {
        console.log('ElasticSearch Dev is now connected!');
    }
})

exports.getAllLinks = function(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_links",
        type: "link",
        size: 500000,
        body: {
        }
    }).then(function(result){
            var links = []
            for(var i=0; i<result.hits.hits.length; i++){
                result.hits.hits[i]._source.value = result.hits.hits[i]._source.distance
                delete result.hits.hits[i]._source.distance
                links.push(result.hits.hits[i]._source)
            }

            deferred.resolve(links)
        })
        .catch(deferred.reject)


    return deferred.promise
}

exports.getLinksForCompany = function(companyId, index){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_links",
        type: "link",
        size: 20,
        body: {
            query: {
                multi_match: {
                    query: companyId,
                    fields: ["source", "target"]
                }
            },
            sort: [
                {"distance": {order: "asc"}}
            ]
        }
    }).then(function(result){
        var links = []
        for(var i=0; i<result.hits.hits.length; i++){
            if(result.hits.hits[i]._source.source == companyId)
                result.hits.hits[i]._source.source = index
            else
                result.hits.hits[i]._source.target = index

            result.hits.hits[i]._source.value = result.hits.hits[i]._source.distance
            delete result.hits.hits[i]._source.distance
            links.push(result.hits.hits[i]._source)
        }

        deferred.resolve(links)
    })
        .catch(deferred.reject)

    return deferred.promise
}

exports.getAllCompanies = function(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_merged",
        type: "company",
        size: 10000,
        body: {
            filter: {
                and: [
                    {
                        exists: {
                            field: "locations"
                        }
                    },
                    {
                        exists: {
                            field: "industries"
                        }
                    },
                    {
                        exists: {
                            field: "employeesMin"
                        }
                    },
                    {
                        exists: {
                            field: "employeesMax"
                        }
                    },
                    {
                        exists: {
                            field: "hasPost"
                        }
                    }
                ]
            }
        }
    }).then(function(result){
        var companies = result.hits.hits,
            comp = []

        for(var i=0; i<companies.length; i++){
            var company = {}
            company.name = companies[i]._id
            company.group = companies[i]._source.industries[0]
            comp.push(company)
        }

        deferred.resolve(comp)

    })
        .catch(deferred.reject)

    return deferred.promise
}

exports.clusters = function(level){
    var array = [],
        deferred = q.defer()

    fs.readFile(__dirname+"/../clusters.json", function(err, data){
        var data = JSON.parse(data)


        plainTree(aggregate1(level, data))

        var normalized = []
        //Normalize Cluster to all be an object containing size and values
        for(var i=0; i<array.length; i++){
            cluster = {}
            cluster.group = 0
            if(Array.isArray(array[i]) ) {
                cluster.size = array[i].length
                cluster.values = array[i]
            }else {
                cluster.size = 1
                cluster.values = [array[i]]
            }
            normalized.push(cluster)
        }

        normalized = mapIndustry(normalized)

        deferred.resolve(mapSizes(normalized))
    })

    function aggregate1(level, tree){
        if(level == 0){
            return tree
        }else if(tree.value){
            return {value: tree.value}
        }

        return [ aggregate1(level-1, tree.left)  ,aggregate1(level-1, tree.right)  ]
    }

    function plainTree(tree){
        if(!Array.isArray(tree))
            array.push(objectsFromTree(tree))

        if(Array.isArray(tree)){
            for(var i=0; i<tree.length; i++){
                if(Array.isArray(tree[i]))
                    plainTree(tree[i])
                else{
                    if(tree[i].value)
                        array.push(tree[i])
                    else
                        array.push(objectsFromTree(tree[i]))
                }

            }
        }
    }

    function objectsFromTree(tree){
        if(tree.value)
            return [tree]

        return objectsFromTree(tree.left).concat(objectsFromTree(tree.right))
    }

    function mapSizes(clusters){
        var sizes = []

        for(var i=0; i<clusters.length; i++){
            if( sizes.indexOf(clusters[i].size) == -1 )
                sizes.push(clusters[i].size)
        }

        sizes.sort(function(a,b){return a - b})

        for(var i=0; i<clusters.length; i++){
            clusters[i].size = sizes.indexOf(clusters[i].size)+1
        }

        return clusters
    }

    function mapIndustry(clusters){

        for(var i=0; i<clusters.length; i++){
            var industries = {}

            for(var j=0; j<clusters[i].values.length; j++){
                for(var k=0; k<clusters[i].values[j].value.industries.length; k++){
                    if(industries[clusters[i].values[j].value.industries[k]])
                        industries[clusters[i].values[j].value.industries[k]] = industries[clusters[i].values[j].value.industries[k]] + 1
                    else
                        industries[clusters[i].values[j].value.industries[k]] = 1
                }
            }
            clusters[i].industryHistogram = industries
            clusters[i].group = maxProp(industries)

        }

        function maxProp(dict){
            var value = -1,
                index = ""

            for(var key in dict){
                if(dict[key] > value || index == "") {
                    value = dict[key]
                    index = key
                }
            }
            return index
        }


        return clusters
    }

    return deferred.promise
}

exports.getPosts = function(from, to){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_post_companies",
        type: "post",
        size: 5000,
        body: {
            filter: {
                and:[
                    {
                        range: {
                            publishingDate: {
                                gte: from,
                                lte: to
                            }
                        }
                    },
                    {
                            exists:{
                                field: "knnProducts"
                            }
                    }
                ]

            }
        }
    }).then(function(result){

        deferred.resolve(result.hits.hits)
    })
        .catch(deferred.reject)

    return deferred.promise
}