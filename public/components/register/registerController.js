registration = angular.module("registration", [
    'ngCookies'
])

registration.controller("registrationCtrl", ['$scope', '$state', '$http', 'n2o_registrationService', '$location', '$cookieStore', '$q', 'n2o_settingsProvider', 'toaster', '$window',
    function($scope, $state, $http, registrationService, $location, $cookieStore, $q, settingsProvider, toaster, $window){

    var queryParams = $location.search(),
        stateRanking = {
            'registration.socialAccounts': 1,
            'registration.account': 2,
            'registration.territory': 3
        },
        linkedInRegistration = {},
        xingRegistration = {},
        groups = []

    //Step 1 - Register social accounts
    $scope.socialAccounts = {
        linkedIn: {
            icon: "assets/img/linkedin_icon.svg",
            registered: false,
            name: 'LinkedIn',
            text: 'Disconnected'
        },
        xing: {
            icon: "assets/img/xing_icon.svg",
            registered: false,
            name: 'Xing',
            text: 'Disconnected'
        }
    }

    //Step 2 - Fill in basic information
    $scope.firstName = ""
    $scope.lastName = ""
    $scope.email = ""
    $scope.password = ""
    $scope.passwordRepeat = ""

    //Step 3 - Choosing Territory
    //$scope.chosenProduct = "Choose product"
    //$scope.products = []

    $scope.territory = {
        products: {
            values: [],
            title: "Product",
            searchFunction: settingsProvider.searchProductNoAuth
        },
        customers: {
            values: [],
            title: "Customers",
            searchFunction: settingsProvider.searchCustomerNoAuth
        },
        countries: {
            values: [],
            title: "Countries",
            searchFunction: settingsProvider.searchCountryNoAuth
        }
        //federalStates: {
        //    values: [],
        //    title: "Federal States",
        //    searchFunction: settingsProvider.searchFederalStatesNoAuth
        //}/*
        //industries: {
        //    values: [],
        //    title: "Industries",
        //    searchFunction: settingsProvider.searchIndustries
        //}*/
    }

    $scope.customers = []
    $scope.products = []
    $scope.countries = []

    var countries = [], customers = []
    $scope.searchResults = []

    $scope.titleProducts = "Select Products"
    $scope.titleCountries = "Select Countries"
    $scope.titleCustomers = "Select Customers"

    // Variables for routing logic
    $scope.highestState = "registration.socialAccounts"
    $scope.state = $state.current.name

    //Do on controller init
    if($cookieStore.get('linkedin')){
        var reg = JSON.parse($cookieStore.get("linkedin"))
        if(!reg.creation || (Date.now() - reg.creation) > (1000*60*10) )
            deleteCookies()
    }
    if($cookieStore.get('xing')){
        var reg = JSON.parse($cookieStore.get("xing"))
        if(!reg.creation || (Date.now() - reg.creation) > (1000*60*10))
            deleteCookies()
    }


    //Parse SocialAccount Information either from a cookie if it exists or from the querystring
    if(queryParams && queryParams.source == 'linkedin' && queryParams.groupcount > 5) {
        $scope.socialAccounts.linkedIn.registered = true
        $scope.socialAccounts.linkedIn.text = 'Connected'
        queryParams.creation = Date.now()
        $cookieStore.put("linkedin", JSON.stringify(queryParams))
        linkedInRegistration = queryParams
    }else if($cookieStore.get('linkedin')){
        $scope.socialAccounts.linkedIn.registered = true
        $scope.socialAccounts.linkedIn.text = 'Connected'
        linkedInRegistration = JSON.parse($cookieStore.get("linkedin"))
    }else if(queryParams &&  queryParams.source == 'linkedin' && queryParams.groupcount <= 5){
        toaster.warning({
            title: "LinkedIn connection error. You are connected to " + queryParams.groupcount + " groups only",
            body: "In order to be able to use this tool properly, please become a member of at least 6 groups. Click here to get to your account",
            timeout: 40000,
            clickHandler: function(){
                $window.open('http://www.linkedin.com', '_blank');
            }
        })
    }

    if(queryParams && queryParams.source == 'xing' && queryParams.groupcount > 5) {
        $scope.socialAccounts.xing.registered = true
        $scope.socialAccounts.xing.text = 'Connected'
        queryParams.creation = new Date(Date.now()).toUTCString()
        $cookieStore.put("xing", JSON.stringify(queryParams))
        xingRegistration = queryParams
    }else if($cookieStore.get('xing')){
        $scope.socialAccounts.xing.registered = true
        $scope.socialAccounts.xing.text = 'Connected'
        xingRegistration = JSON.parse($cookieStore.get("xing"))
    }else if(queryParams &&  queryParams.source == 'xing' && queryParams.groupcount <= 5){
        toaster.warning({
            title: "Xing connection error. You are connected to " + queryParams.groupcount + " groups only",
            body: "In order to be able to use this tool properly, please become a member of at least 6 groups. Click here to get to your account",
            timeout: 40000,
            clickHandler: function(){
                $window.open('http://www.xing.com', '_blank');
            }
        })
    }

    //Reload account information on reload
    if (($state.current.name == 'registration.account') && (!$cookieStore.get('xing')) && (!$cookieStore.get('xing'))) {
        $state.go('registration.socialAccounts')
        $state.state = 'registration.socialAccounts'
    } else {
        applyPersonalInformation()
    }

    //Steptransition
    $scope.processForm = function(){
        switch($state.current.name){
            case 'registration.socialAccounts':
                if(Object.keys(linkedInRegistration).length > 0 || Object.keys(xingRegistration).length > 0 ){
                    $state.go('registration.account')
                    $scope.highestState = 'registration.account'
                    $scope.state = 'registration.account'
                    $scope.error = null
                    applyPersonalInformation()
                }else{
                    toaster.error({
                        title: "You have to be connected to at least one social network",
                        timeout: 10000
                    })
                }
                break
            case 'registration.account':
                if($scope.password.length > 7 && $scope.password.match(/\d/g) && $scope.firstName.length > 0 && $scope.lastName.length > 0 && $scope.email.length > 0 && $scope.accesscode == "sap2015"){
                    if($scope.password == $scope.passwordRepeat){
                        $state.go('registration.territory')
                        $scope.highestState = 'registration.territory'
                        $scope.state = 'registration.territory'
                        $scope.error = null
                        prepareTerritorySettings()
                    }else{
                        toaster.error({
                            title: "Your password repeat was wrong"
                        })
                    }
                }else if($scope.accesscode != "sap2015") {
                    toaster.error({
                        title: "Your Accesscode was wrong"
                    })
                }else{
                    toaster.error({
                        title: "Password should contain at least on number and overall at least 8 characters"
                    })
                }

                break
            case 'registration.territory':
                if(true){
                    registerUser()
                        .then(function () {
                            deleteCookies()
                            $state.go('login')
                        })
                        .catch(function () {
                            $scope.error = 'This e-mail address is already taken'
                        })
                }
                break
            default:
                break
        }
    }


    //Public functions
    $scope.navigateTo = function(state){
        if(stateRanking[state] <= stateRanking[$scope.highestState]) {
            $state.go(state)
            $scope.state = state
        }
    }

    $scope.registerAccount = function(network){
        if(network == 'linkedIn' && !$scope.socialAccounts.linkedIn.registered)
            registrationService.linkedInRegistrationLink("registration")
                .success(function(data){
                    window.location.href = data.redirect
                })
        else if(network == 'xing' && !$scope.socialAccounts.xing.registered)
            registrationService.xingRegistrationLink('registration')
                .success(function(data){
                    window.location.href = data.redirect
                })
        else if(network == 'xing' && $scope.socialAccounts.xing.registered){
            $scope.socialAccounts.xing.registered = false
            $scope.socialAccounts.xing.text = 'Disconnected'
            xingRegistration = {}
            deleteCookies('xing')
        }else if(network == 'linkedIn' && $scope.socialAccounts.linkedIn.registered) {
            $scope.socialAccounts.linkedIn.registered = false
            $scope.socialAccounts.linkedIn.text = 'Disconnected'
            linkedInRegistration = {}
            deleteCookies('linkedin')
        }
    }

    $scope.selectProduct = function(product){
        $scope.chosenProduct = product
    }

    $scope.cancel = function(){
        $state.go("login")
    }

    //Step 3 - Setup your territory
    //Add
    $scope.addTag = function(key, tag){
    }

    $scope.removeTag = function(territory, entity){
    }

    $scope.search = function(territory, query){
        var deferred = $q.defer()
        $scope.territory[territory].searchFunction(query)
            .then(function(data){
                var searchResult = []
                for(var i=0; i<data.length; i++){
                    searchResult.push({text: data[i]})
                }
                deferred.resolve(searchResult)
            })

        return deferred.promise
    }

    //Private Functions
    function applyPersonalInformation(){
        if(Object.keys(linkedInRegistration).length > 0){
            $scope.firstName = linkedInRegistration.firstname
            $scope.lastName = linkedInRegistration.lastname
            $scope.email = linkedInRegistration.email
        }else if(Object.keys(xingRegistration).length > 0){
            $scope.firstName = xingRegistration.firstname
            $scope.lastName = xingRegistration.lastname
            $scope.email = xingRegistration.email
        }
    }

    function prepareTerritorySettings(){
        //if($scope.products.length == 0){
        //    $http.get("/api/territory/allproducts")
        //        .success(function(data){
        //            data.forEach(function(product){
        //                $scope.products.push(product.PRODUCT)
        //            })
        //        })
        //}

    }

    function deleteCookies(network){
        if(network == 'linkedin')
            $cookieStore.remove("linkedin")
        else if(network == 'xing')
            $cookieStore.remove("xing")
        else{
            $cookieStore.remove("linkedin")
            $cookieStore.remove("xing")
        }
    }

    function registerUser(){
        var deferred = $q.defer()
        var countries = []

        for(var i=0; i<$scope.territory.countries.values.length; i++){
            countries.push($scope.territory.countries.values[i].text.match(/\(.*\)/)[0].replace("(","").replace(")", ""))
        }


        var newUser = {
            username: $scope.email,
            firstname: $scope.firstName,
            lastname: $scope.lastName,
            password: $scope.password,
            //product: $scope.chosenProduct,
            access_tokens: {},
            groups: groups,
            territory: {
                companies: $scope.territory.customers.values.map(function(element){return element.text}),
                languages: countries,
                federal_states: [],
                products: $scope.territory.products.values.map(function(element){return element.text}),
                industries: []
            }
        }

        if(Object.keys(linkedInRegistration).length > 0){
            var token = {}
            token.userid = linkedInRegistration.userid
            token.expires_on = linkedInRegistration.expires_on
            token.token = linkedInRegistration.access_token
            token.pictureurl = linkedInRegistration.pictureurl
            token.groups = linkedInRegistration.groups
            token.groupNames = linkedInRegistration.groupnames
            newUser.access_tokens.linkedin = token
        }
        if(Object.keys(xingRegistration).length > 0){
            var token = {}
            token.userid = xingRegistration.userid
            token.token_secret = xingRegistration.access_token_secret
            token.token = xingRegistration.access_token
            token.groups = xingRegistration.groups
            token.groupNames = xingRegistration.groupnames
            newUser.access_tokens.xing = token
        }

        $http.post("/api/register", newUser)
            .success(function(){
                toaster.success({
                    title: "Registration",
                    body: "You successfully registered a new Account"
                })
                deferred.resolve()
            })
            .error(function() {
                deferred.reject()
            })

        return deferred.promise
    }


}])