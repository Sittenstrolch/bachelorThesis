var q       = require('q')
var config  = require('../config.js')
var esearch = require('elasticsearch')
var request       = require('request')
var industries = require(__dirname+"/linkedinCompanies.js")

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
                    }else
                        populate()
                })
        }

        populate()

    }
})

function getCompaniesFromDB(){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies",
        type: "company",
        size: 1000,
        body: {
            filter: {
                and: [
                    {
                        exists: {
                            field: "name"
                        }
                    },
                    {
                        not: {
                            exists: {
                                field: "merged"
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
            getCompany(data.hits[index]._source)
                .then(mergeCompanies)
                .then(updateCompany)
                .then(function(company){
                    console.log(" + \t" + match + "|" + notMatch + "\t" + data.hits[index]._source.name + " merged with " + company.name)
                    updateCompany({id: data.hits[index]._id, data: {}, index: "ba_companies"}, false)

                    match++
                    index += 1


                    //console.log("updated company " + company + " at index " + index + "/" + data.hits.length)
                    //

                    processCompany()
                })
                .catch(function(err){
                    notMatch++
                    //Could not match an appropriate existing company so just create a new one
                    if(err && err != "No results"){
                        console.log("[ERROR]: " + err)
                        updateCompany({id: data.hits[index]._id, data: {}, index: "ba_companies"}, true)
                    }else{
                        console.log(" - \t"+ match + "|" + notMatch + "\t" +"No match for " + data.hits[index]._source.name)
                        insertAsNewCompany(data.hits[index]._source)
                            .then(saveCompany)
                            .then(function(company){
                                updateCompany({id: company.linkedin_id, data: {}, index: "ba_companies"}, false)
                            })

                    }

                    index += 1
                    processCompany()
                })
    }

    if(data.hits.length == 0)
        deferred.resolve(true)

    processCompany()

    return deferred.promise
}

function getCompany(companyLI){
    var deferred = q.defer()

    elasticClient.search({
        index: "ba_companies_cb",
        body: {
            query: {
                match:{
                    name: companyLI.name
                }
            },
            filter: {
                and: [
                    {
                        exists: {
                            field: "crunchbase_uuid"
                        }
                    }
                ]
            }
        }
    }).then(function(data){
        //console.log(JSON.stringify(data.hits.hits, null, 4))
        if(data.hits.total > 0){
                chooseRightCompany(companyLI, data.hits.hits)
                    .then(function(company){
                        var object = {companyLI: companyLI, companyCB: company}
                        deferred.resolve(object)
                    })
                    .catch(function(){
                            deferred.reject("No results")
                    })
        }else{
            deferred.reject("No results")
            //deferred.reject(data.hits.hits[0]._source.error.message)
        }
    })


    return deferred.promise
}

function chooseRightCompany(companyLI, matches){
    var deferred = q.defer()
    var equal = companyLI.name == matches[0]._source.name

    function stripUrl(url, naked){
        url = url.replace("http://www.", "")
        url = url.replace("https://www.", "")
        url = url.replace("https://", "")
        url = url.replace("http://", "")
        if(url.indexOf("www.") == 0){
            url = url.replace("www.", "")
        }
        var slashPos = url.indexOf("/")
        if(slashPos > -1){
            url = url.substr(0,slashPos)
        }

        var pointPos = url.lastIndexOf(".")
        if(naked && pointPos > -1){
            url = url.substr(0,pointPos)
        }

        return url
    }

    //console.log("Equals: " + companyLI.name + " - " + equal)
    if(companyLI.name == matches[0]._source.name){
        //console.log(companyLI.name + " matches " + matches[0]._source.name)
        deferred.resolve(matches[0]._source)
    }else{
        for(var i=0; i<matches.length; i++){
            //console.log(matches[i]._score + " | " + matches[i]._source.name + " | " + matches[i]._source.homepage_url)
            if(matches[i]._source.homepage_url && companyLI.websiteUrl) {
                if (stripUrl(companyLI.websiteUrl, false) == stripUrl(matches[i]._source.homepage_url, false)) {
                    deferred.resolve(matches[i]._source)
                    return deferred.promise
                }else
                {
                    //if(stripUrl(companyLI.websiteUrl, true) == stripUrl(matches[i]._source.homepage_url, true)){
                    //    console.log("Possible match! ")
                    //    deferred.reject(matches[i]._source)
                    //    return deferred.promise
                    //}
                    var strippedLI = stripUrl(companyLI.websiteUrl, true),
                        strippedCB = stripUrl(matches[i]._source.homepage_url, true)

                    if(strippedCB.indexOf("*") == -1 && strippedLI.indexOf("*") == -1 && strippedCB.indexOf("?") == -1 && strippedLI.indexOf("?") == -1) {
                        var liissub1 = strippedCB.match(new RegExp("(.+\\.|^)" + strippedLI + "\\.", "g")),
                            liissub2 = strippedCB.match(new RegExp("\\." + strippedLI + "(\\..+|$)", "g")),
                            cbissub1 = strippedLI.match(new RegExp("(.+\\.|^)" + strippedCB + "\\.", "g")),
                            cbissub2 = strippedLI.match(new RegExp("\\." + strippedCB + "(\\..+|$)", "g"))


                        if (liissub2 || liissub1 || cbissub1 || cbissub2) {
                            deferred.resolve(matches[i]._source)
                            return deferred.promise
                        }
                    }
                        //console.log("May Equal " + mayEqual + " | " + companyLI.websiteUrl + " ==== " + matches[i]._source.homepage_url)

                }
            }
        }
        //console.log(companyLI.name + " should match " + matches[0]._source.name)
        deferred.reject()
    }

    return deferred.promise
}

function mergeCompanies(companiesPassed){
    var deferred = q.defer(),
        companyLI = companiesPassed.companyLI,
        companyCB = companiesPassed.companyCB

    try {
        companyCB.linkedin_id = companyLI.id
        //Set employee count
        if (!companyCB.employeesMin) {
            if (companyLI.employeeCountRange) {
                if (companyLI.employeeCountRange.name.indexOf("+") == -1) {
                    companyCB.employeesMin = companyLI.employeeCountRange.name.split("-")[0]

                    if (!companyCB.employeesMax)
                        companyCB.employeesMax = companyLI.employeeCountRange.name.split("-")[1]
                } else {
                    companyCB.employeesMin = companyLI.employeeCountRange.name.split("+")[0]
                }

            }
        }

        //Add Founding Year
        if (!companyCB.foundingYear) {
            if (companyLI.foundedYear) {
                companyCB.foundingYear = companyLI.foundedYear
            }
        }

        //Add addresses
        if (companyLI.locations) {
            for (var i = 0; i < companyLI.locations.values.length; i++) {
                var location = {},
                    address = companyLI.locations.values[i].address
                if (address.city)
                    location.city = address.city
                if (address.countryCode)
                    location.countryCode = address.countryCode
                if (address.postalCode)
                    location.postalCode = address.postalCode
                if (address.street1)
                    location.street = address.street1

                if (companyCB.offices)
                    companyCB.offices.push(location)
                else
                    companyCB.offices = [location]
            }
        }

        //Add industries
        if (companyLI.industries) {
            for (var i = 0; i < companyLI.industries.values.length; i++) {
                if (companyCB.industries)
                    companyCB.industries.push(industries.mapping[companyLI.industries.values[i].code])
                else
                    companyCB.industries = [industries.mapping[companyLI.industries.values[i].code]]
            }
        }

        //Add specialties
        if (companyLI.specialties) {
            companyCB.expertise = companyLI.specialties.values
        }

        //Add description
        if (companyLI.description){
            companyCB.description = companyLI.description
        }
        if(companyCB.crunchbase_uuid)
            deferred.resolve({id: companyCB.crunchbase_uuid, data: companyCB, index: "ba_companies_cb"})
        else
            deferred.reject("ID undefined for cb company")

    }catch(err){
        console.log("error in merge ")
        console.log(Object.keys(companiesPassed))
        deferred.reject(err)
    }

    return deferred.promise
}

function insertAsNewCompany(companyLI){
    var deferred = q.defer(),
        newCompany = {}

    newCompany.linkedin_id = companyLI.id
    newCompany.merged = true
    if(companyLI.name)
        newCompany.name = companyLI.name

    if(companyLI.logoUrl)
        newCompany.profile_image_url = companyLI.logoUrl

    if(companyLI.websiteUrl)
        newCompany.homepage_url = companyLI.websiteUrl

    if(companyLI.twitterId)
        newCompany.twitter_url = companyLI.twitterId

    //Add employees count
    if (companyLI.employeeCountRange) {
        if(companyLI.employeeCountRange.name == "myself only"){
            newCompany.employeesMax = 1
        }else if (companyLI.employeeCountRange.name.indexOf("+") == -1) {
            newCompany.employeesMin = companyLI.employeeCountRange.name.split("-")[0]
            newCompany.employeesMax = companyLI.employeeCountRange.name.split("-")[1]

        } else {
            newCompany.employeesMin = companyLI.employeeCountRange.name.split("+")[0]
        }

    }

    //Add founding year
    if (companyLI.foundedYear) {
        newCompany.foundingYear = companyLI.foundedYear
    }

    //Add addresses
    if (companyLI.locations) {
        for (var i = 0; i < companyLI.locations.values.length; i++) {
            var location = {},
                address = companyLI.locations.values[i].address
            if (address.city)
                location.city = address.city
            if (address.countryCode)
                location.countryCode = address.countryCode
            if (address.postalCode)
                location.postalCode = address.postalCode
            if (address.street1)
                location.street = address.street1

            if (newCompany.offices)
                newCompany.offices.push(location)
            else
                newCompany.offices = [location]
        }
    }

    //Add industries
    if (companyLI.industries) {
        for (var i = 0; i < companyLI.industries.values.length; i++) {
            if (newCompany.industries)
                newCompany.industries.push(industries.mapping[companyLI.industries.values[i].code])
            else
                newCompany.industries = [industries.mapping[companyLI.industries.values[i].code]]
        }
    }

    //Add specialties
    if (companyLI.specialties) {
        newCompany.expertise = companyLI.specialties.values
    }

    //Add description
    if (companyLI.description){
        newCompany.description = companyLI.description
    }

    deferred.resolve(newCompany)

    return deferred.promise
}

function updateCompany(company, fail){
    var deferred = q.defer()
    if(!fail)
        company.data.merged = true
    else
        company.data.merged = false
    if(company)
        elasticClient.update({
            index: company.index,
            id: company.id,
            type: "company",
            ignoreUnavailable: true,
            allowNoIndices: true,
            body: {
                doc: company.data
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
    else
        console.log("undefined company in update")

    return deferred.promise
}

function saveCompany(company){
    var deferred = q.defer()

    elasticClient.index({
        index: "ba_companies_cb",
        type: "company",
        id: company.linkedin_id,
        ignoreUnavailable: true,
        allowNoIndices: true,
        body: company
    }, function(err) {
        if(err) {
            console.log("Error on saving new company " + company.linkedin_id + " " + err)
            deferred.reject({id: company.linkedin_id, error: err})
        }else
            deferred.resolve(company)
    })

   return deferred.promise
}