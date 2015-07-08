var industryMapping = require(__dirname + '/industries.js')

exports.compare = function (company1, company2){
    var industryScore   = 0,
        locationScore   = 0,
        sizeScore       = 0

    //Compare Industries
    function hasIndustry(industry, industryArray){
        for(var j=0; j<industryArray.length; j++){
            if(industryMapping.industries[industryArray[j]] && industryMapping.industries[industry]){
                if(industryMapping.industries[industryArray[j]] == industryMapping.industries[industry])
                    return true
            }else
                return false
        }
        return false
    }

    var industryMatchCount = 0
    for(var i=0; i<company1.industries.length; i++){
        if(company2.industries.indexOf(company1.industries[i]) > -1){
            industryMatchCount++
        }else if(hasIndustry(company1.industries[i], company2.industries))
            industryMatchCount++
    }

    if(industryMatchCount > 4)
        industryScore = 1 //6
    else if(industryMatchCount > 0)
        industryScore = 1 //5



    //Compare locations
    var cityMatch = false,
        countryMatch = false
    for(var i=0; i<company1.locations.length; i++){
        for(var j=0; j<company2.locations.length; j++){
            if(company1.locations[i].countryCode == company2.locations[j].countryCode){
                countryMatch = true
                if(company1.locations[i].city == company2.locations[j].city){
                    cityMatch = true
                }
            }
        }
    }

    if(cityMatch){
        locationScore = 1//5
    }else if(countryMatch){
        locationScore = 1//2
    }

    //Compare size

    if(company1.employeesMin == company2.employeesMin && company2.employeesMax == company1.employeesMax)
        sizeScore = 1

    return 1 - ( 0*locationScore/1 + 1*industryScore/1 + 0*sizeScore/1 )
}