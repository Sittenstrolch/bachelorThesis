var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')
var industries = require(__dirname+"/linkedinCompanies.js")
var countrycodes = require(__dirname+"/reverseCountryCode.js").codes

var fs = require('fs')

var company = config.company,
    crawlerIndex = config.crawlerIndex,
    metaIndex      = config.metaIndex,
    allPostsIndex = '_post_*',
    host = '141.89.225.46',
    port = 9200

var elasticClient = new esearch.Client({
    host: host + ":" + port //config.database.dev_host + ':' + config.database.port
})

var token = "def1fecedee41e6d3d6650a4f6d6de5e",
    match = 0,
    notMatch = 0

elasticClient.ping({
    requestTimeout: 2000,
    hello: "elasticsearch!"
}, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('ElasticSearch is now connected!');
        //Adding Permalinks to current dataset
        function populate() {
            getCompaniesFromDB()
                .then(iterateResult)
                .then(function(finished){
                    //console.log(JSON.stringify(data, null, 4).substring(0,2000))

                    if(finished){
                        console.log("finished")

                        console.log("Matches " + match + "/" + notMatch)
                        process.exit(1)
                    }else {
                        populate()
                    }
                })
        }

        populate()

    }
})

function getCompaniesFromDB(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_cb",
        type: "company",
        size: 1000,
        body: {
            filter: {
                and: [
                    {
                        exists: {
                            field: "offices"
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
                        not: {
                            exists: {
                                field: "remapped"
                            }
                        }
                    }
                ]
            }
        }
    }).then(function(data){
        deferred.resolve(data.hits)
    })

    return deferred.promise
}

function iterateResult(data){
    var deferred = q.defer(),
        index = 0

    function processCompany(){
        if(index == data.hits.length) {
            console.log("Part finished getting next one")
            deferred.resolve(false)
        }else
            remapCompany(data.hits[index]._source)
                .then(saveCompany)
                .then(function(company){
                    console.log("Remaped: " + company.name)
                    updateCompany(data.hits[index]._id)

                    index += 1
                    processCompany()
                })
                .catch(function(err){
                    console.log("[ERROR]: " + data.hits[index]._id + " | " + err  )


                    index += 1
                    //processCompany()
                })
    }

    if(data.hits.length == 0)
        deferred.resolve(true)

    processCompany()

    return deferred.promise
}

function remapCompany(company){
    var deferred = q.defer(),
        newCompany = {}

    try {
        if(company.linkedin_id)
            newCompany.linkedin_id = company.linkedin_id
        if(company.crunchbase_uuid)
            newCompany.crunchbase_uuid = company.crunchbase_uuid

        newCompany.employeesMin = company.employeesMin
        newCompany.employeesMax = company.employeesMax

        if(company.foundingYear)
            newCompany.founded = company.foundingYear

        newCompany.industries = company.industries

        if(company.expertise)
            newCompany.expertise = company.expertise

        if(company.name)
            newCompany.name = company.name

        if(company.description)
            newCompany.description = company.description
        else if(company.short_description)
            newCompany.description = company.short_description

        if(company.profile_image_url)
            newCompany.logo = company.profile_image_url

        if(company.permalink)
            newCompany.permalink = company.permalink

        function alreadyExists(location){
            for(var i=0; i<newCompany.locations.length; i++){
                if(newCompany.locations[i].countryCode && newCompany.locations[i].city){
                    if(newCompany.locations[i].countryCode == location.countryCode && newCompany.locations[i].city == location.city){
                        return true
                    }
                }
            }
            return false
        }

        //Add addresses
        if(company.offices){
            for (var i = 0; i < company.offices.length; i++) {
                var location = {},
                    address = company.offices[i]
                if (address.city)
                    location.city = address.city
                if (address.street)
                    location.street = address.street
                if (address.countryCode)
                    location.countryCode = address.countryCode.toUpperCase()
                else if(address.country) {
                    if(countrycodes[address.country])
                        location.countryCode = countrycodes[address.country]
                    else
                        location.country = address.country
                }


                if (address.postalCode)
                    location.postalCode = address.postalCode
                if (address.region)
                    location.region = address.region

                if (newCompany.locations) {
                    if(!alreadyExists(location))
                        newCompany.locations.push(location)
                }else
                    newCompany.locations = [location]
            }
        }

        deferred.resolve(newCompany)

    }catch(err){
        console.log("error in merge ")
        console.log(Object.keys(company))
        deferred.reject(err)
    }

    return deferred.promise
}

function updateCompany(companyId){
    var deferred = q.defer()

    elasticClient.update({
        index: "ba_companies_cb",
        id: companyId,
        type: "company",
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: {
            doc: {
                remapped: true
            }
        }
    }, function(err) {
        if(err) {
            console.log("Error on some update " +  company.id + "  " + err)
            deferred.reject(err)
        }else {
            //console.log("updated company with id: " + company.uuid + " and link " + company.properties.permalink + " with index " + company.index)
            deferred.resolve(company.data)
        }
    })

    return deferred.promise
}

function saveCompany(company){
    var deferred = q.defer(),
        id = ""

    if(company.crunchbase_uuid) {
        id = company.crunchbase_uuid
        company.id = company.crunchbase_uuid
    }else if(company.linkedin_id) {
        id = company.linkedin_id
        company.id = company.linkedin_id
    }

    elasticClient.index({
        index: "ba_companies_merged",
        type: "company",
        id: id,
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: company
    }, function(err) {
        if(err) {
            console.log("Error on saving new company " + company.linkedin_id + " " + err)
            deferred.reject(err)
        }else
            deferred.resolve(company)
    })

    return deferred.promise
}