var graphAnalyser = angular.module('graphAnalyser', [])

graphAnalyser.controller("graphAnalyserCtrl", ['$scope', 'ba_graphProvider', '$interval','$q', function($scope, graphProvider, $interval, $q){
    var graphSpace = angular.element(document.getElementsByClassName('graphSpace')[0]),
        header = angular.element(document.getElementsByClassName('graphHeader')[0]),
        footer = angular.element(document.getElementsByClassName('graphFooter')[0]),
        interval = null,
        clear = true

    //Scope variables
    $scope.width = graphSpace[0].offsetWidth;
    $scope.height = graphSpace[0].offsetHeight - header[0].offsetHeight - footer[0].offsetHeight;
    $scope.showDetails = false
    $scope.detailsCompany = true
    $scope.companyDetail = {
        name: "Apple",
        logo: "http://logok.org/wp-content/uploads/2014/04/Apple-Logo-rainbow.png",
        employeesMin: 20,
        employeesMax: 500,
        link: "http://www.apple.com",
        description: "",
        industries: []
    }
    $scope.clusterDetail = {}
    $scope.minDate = 1426179204000
    $scope.maxDate = 1435599880000
    $scope.interval = $scope.maxDate - $scope.minDate
    $scope.topDate = $scope.minDate + $scope.interval
    $scope.size = 2
    $scope.nodeDistance = "No distance defined"
    $scope.toNode = -1
    $scope.currentNode = -1
    $scope.clusterStats = {}
    $scope.overallClusterStats = {}
    $scope.avgHighest = 0
    $scope.avgRating = 0

    var color = d3.scale.category20()
    var productColor = d3.scale.category20()

    var force = d3.layout.force()
        .charge(-10)
        .linkDistance(150)
        .size([$scope.width, $scope.height]);

    function loadData(level, links) {
        var deferred = $q.defer()

        graphProvider.graphData(level, links)
            .then(function (graph) {
                $scope.nodes = graph.nodes;
                $scope.links = graph.links;
                deferred.resolve()
            })

        return deferred.promise
    }

    graphProvider.graphData()
        .then(function (graph) {
            $scope.nodes = graph.nodes;
            $scope.links = graph.links;

            for (var i = 0; i < $scope.links.length; i++) {
                $scope.links[i].strokeWidth = Math.round($scope.links[i].value)
            }

            for (var i = 0; i < $scope.nodes.length; i++) {
                $scope.nodes[i].color = color($scope.nodes[i].group)
            }

            force
                .nodes($scope.nodes)
                .links([])
                .on("tick", function () {
                    $scope.$apply()
                })
                .start();

            interval = $interval(function () {
                var changed = false
                for (var i = 0; i < $scope.nodes.length; i++) {
                    var node = $scope.nodes[i]
                    if (node.y < 0) {
                        node.y = 15
                        changed = true
                    } else if (node.y > $scope.height) {
                        node.y = $scope.height - 20
                        changed = true
                    }
                }
                if (!changed)
                    $interval.cancel(interval)
            }, 5000)
        })

    $scope.rerender = function(){
        force.stop()
        force.start()
    }

    var gotPosts = []
    $scope.apply = function(notReload){
        var deferred = $q.defer()
        $scope.size = $scope.size + 1

        //clear old values
        if(clear)
            for(var k=0; k<$scope.nodes.length;k++){
                $scope.nodes[k].hasPost = 0
                $scope.nodes[k].products = {}
                $scope.nodes[k].companies = {}
            }

        if(notReload){
            var posts = gotPosts
            for(var i=0; i<posts.length; i++){
                for(var j=0; j<$scope.nodes.length; j++){
                    if(clusterHasCompany(posts[i]._source.company.id, $scope.nodes[j])){
                        $scope.nodes[j].hasPost += 1
                        var companyId = posts[i]._source.company.id

                        //update company product distribution
                        if($scope.nodes[j].companies){
                            if($scope.nodes[j].companies[companyId]){

                            }else{
                                $scope.nodes[j].companies[companyId] = {}
                            }

                            for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                if($scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name])
                                    $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] += 1
                                else
                                    $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] = 1
                            }
                        }else{
                            $scope.nodes[j].companies = {}

                            if($scope.nodes[j].companies[companyId]){

                            }else{
                                $scope.nodes[j].companies[companyId] = {}
                            }

                            for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                if($scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name])
                                    $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] += 1
                                else
                                    $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] = 1
                            }
                        }

                        if($scope.nodes[j].products) {
                            for (var k = 0; k < posts[i]._source.knnProducts.length; k++) {
                                posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                if($scope.nodes[j].products[posts[i]._source.knnProducts[k].name]) {
                                    if ($scope.nodes[j].products[posts[i]._source.knnProducts[k].name].companies.indexOf(posts[i]._source.company.id) == -1) {
                                        $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].count += 1
                                        $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].dates.push(posts[i]._source.publishingDate)
                                        $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].dates.sort(function (a, b) {
                                            return a - b
                                        })
                                        $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].companies.push(posts[i]._source.company.id)
                                    }
                                }else
                                    $scope.nodes[j].products[posts[i]._source.knnProducts[k].name] = {
                                        count: 1,
                                        dates: [posts[i]._source.publishingDate],
                                        companies: [posts[i]._source.company.id]

                                    }
                            }
                        }else{
                            $scope.nodes[j].products = {}

                            for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                $scope.nodes[j].products[posts[i]._source.knnProducts[k].name] = {
                                    count: 1,
                                    dates: [posts[i]._source.publishingDate],
                                    companies: [posts[i]._source.company.id]
                                }
                            }
                        }

                    }

                }
            }
            deferred.resolve()
        }else
            graphProvider.posts($scope.minDate, $scope.topDate)
                .then(function(posts){
                gotPosts = posts
                for(var i=0; i<posts.length; i++){
                    for(var j=0; j<$scope.nodes.length; j++){
                        if(clusterHasCompany(posts[i]._source.company.id, $scope.nodes[j])){
                            $scope.nodes[j].hasPost += 1
                            var companyId = posts[i]._source.company.id

                            //update company product distribution
                            if($scope.nodes[j].companies){
                                if($scope.nodes[j].companies[companyId]){

                                }else{
                                    $scope.nodes[j].companies[companyId] = {}
                                }

                                for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                    posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                    if($scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name])
                                        $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] += 1
                                    else
                                        $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] = 1
                                }
                            }else{
                                $scope.nodes[j].companies = {}

                                if($scope.nodes[j].companies[companyId]){

                                }else{
                                    $scope.nodes[j].companies[companyId] = {}
                                }

                                for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                    posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                    if($scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name])
                                        $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] += 1
                                    else
                                        $scope.nodes[j].companies[companyId][posts[i]._source.knnProducts[k].name] = 1
                                }
                            }

                            if($scope.nodes[j].products) {
                                for (var k = 0; k < posts[i]._source.knnProducts.length; k++) {
                                    posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                    if($scope.nodes[j].products[posts[i]._source.knnProducts[k].name]) {
                                        if($scope.nodes[j].products[posts[i]._source.knnProducts[k].name].companies.indexOf(posts[i]._source.company.id) == -1) {
                                            $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].count += 1
                                            $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].dates.push(posts[i]._source.publishingDate)
                                            $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].dates.sort(function (a, b) {return a - b})
                                            $scope.nodes[j].products[posts[i]._source.knnProducts[k].name].companies.push(posts[i]._source.company.id)
                                        }
                                    }else
                                        $scope.nodes[j].products[posts[i]._source.knnProducts[k].name] = {
                                            count: 1,
                                            dates: [posts[i]._source.publishingDate],
                                            companies: [posts[i]._source.company.id]

                                        }
                                }
                            }else{
                                $scope.nodes[j].products = {}

                                for(var k = 0; k<posts[i]._source.knnProducts.length;k++){
                                    posts[i]._source.knnProducts[k].name = posts[i]._source.knnProducts[k].name.toUpperCase()
                                    $scope.nodes[j].products[posts[i]._source.knnProducts[k].name] = {
                                        count: 1,
                                        dates: [posts[i]._source.publishingDate],
                                        companies: [posts[i]._source.company.id]
                                    }
                                }
                            }

                        }

                    }
                }

                deferred.resolve()

            })

        return deferred.promise
    }

    $scope.closeDetail = function(){
        $scope.cleanConnections(true, true)
        $scope.showDetail = false
    }

    $scope.displayInfo = function(node, index){
        $scope.cleanConnections(true, true)
        $scope.showDetail = true

        $scope.nodeDistance = "No distance"

        $scope.toNode = $scope.currentNode
        $scope.currentNode = index
        $scope.clusterStats = {}
        $scope.overallClusterStats = {}
        node.showsDetail = true

        console.log(node)

        var stats = generateStatsForNode(node)
        stats = sortOnKeys(stats)

        for(var product in stats){
            if(product.toLowerCase() != "undefined")
                $scope.clusterStats[product] = {
                    percent: Math.round(stats[product]),
                    color: productColor(product)
                }
        }

        $scope.clusterDetail.rating = clusterRating(stats)

        //Calculate number of covered companies
        var numberOfCompanies = 0
        for(var i=0; i < $scope.nodes.length ; i++){
            if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].companies).length > 0) {
                numberOfCompanies += $scope.nodes[i].values.length
            }
        }

        var allDists = {},
            avgRating = 0
        for(var i=0; i < $scope.nodes.length ; i++){
            if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].companies).length > 0) {
                allDists[i] = generateStatsForNode($scope.nodes[i])
                avgRating += clusterRating(allDists[i]) * ($scope.nodes[i].values.length / numberOfCompanies)
            }
        }

        $scope.avgRating = avgRating

        var overallStats = generateOverallStats(allDists)
        overallStats = sortOnKeys(overallStats)
        for(var product in overallStats){
            if(product.toLowerCase() != "undefined")
                $scope.overallClusterStats[product] = {
                    percent: Math.round(overallStats[product]),
                    color: productColor(product)
                }
        }

        $scope.avgHighest = Math.round(getHighestAvg(allDists))

        var demandGrowth = generateDemandGrowth(node)

        var allGrowth = {}

        for(var i=0; i < $scope.nodes.length ; i++){
            if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].products).length > 0) {
                allGrowth[i] = generateDemandGrowth($scope.nodes[i])
            }
        }

        var generalGrowth = overallGrowth(allGrowth)

        //Cluster is a company itself
        if(node.values.length == 1){
            $scope.detailsCompany = true

            $scope.companyDetail.name = node.values[0].value.name
            $scope.companyDetail.logo = node.values[0].value.logo
            $scope.companyDetail.employeesMin = node.values[0].value.employeesMin
            $scope.companyDetail.employeesMax = node.values[0].value.employeesMax
            $scope.companyDetail.description = node.values[0].value.description
            $scope.companyDetail.industries = node.values[0].value.industries
            $scope.companyDetail.products = node.products
            $scope.companyDetail.nodeIndex = index
        }else{
            $scope.detailsCompany = false

            $scope.clusterDetail.products = node.products
            $scope.clusterDetail.industry = node.group
            $scope.clusterDetail.size = node.values.length
            $scope.clusterDetail.nodeIndex = index
            $scope.clusterDetail.demandGrowth = demandGrowth
            $scope.clusterDetail.generalGrowth = generalGrowth
        }
    }

    $scope.getDistance = function(from, to){
        $scope.nodes[from].clickedNode = true
        $scope.nodes[to].clickedNode = true

        for(var i=0; i<$scope.links.length; i++){
            if($scope.links[i].source.index == from && $scope.links[i].target.index == to) {
                $scope.nodeDistance = $scope.links[i].value
                return
            }else if($scope.links[i].source.index == to && $scope.links[i].target.index == from){
                $scope.nodeDistance = $scope.links[i].value
                return
            }
        }
        $scope.nodeDistance = "No Connection available"
    }

    $scope.zoomToDetail = function(){
        console.log("Display company with connected companies")
    }

    $scope.$watch("interval", function(newVal, oldVal){
        $scope.topDate = parseInt($scope.minDate) + parseInt(newVal)
        if(newVal > oldVal)
            clear = false
        else
            clear = true
    })

    $scope.connections = function(index){
        var existingLinks = []
        for(var i=0; i<$scope.links.length; i++){
            if($scope.links[i].source.index == index) {
                //$scope.links[i].visible = true
                $scope.nodes[$scope.links[i].target.index].highlight = true
                existingLinks.push($scope.links[i])
            }else if($scope.links[i].target.index == index){
                //$scope.links[i].visible = true
                $scope.nodes[$scope.links[i].source.index].highlight = true
                existingLinks.push($scope.links[i])
            }
        }

        $scope.nodes[index].selected = true
    }

    $scope.cleanConnections = function(cleanSelection, unClick){
        //for(var i=0; i<$scope.links.length; i++){
        //        $scope.links[i].visible = false
        //}
        for(var i=0; i<$scope.nodes.length; i++){
            $scope.nodes[i].highlight = false
            if(cleanSelection)
                $scope.nodes[i].clickedNode = false
            $scope.nodes[i].selected = false
            if(unClick)
                $scope.nodes[i].showsDetail = false
        }
    }

    //IMPORTANT!! : enter treedepth here

    var treeDepth = 103
    $scope.compareCluster = function(){
        force.stop()
        var index = 0,
            bestLevel = 0,
            bestRating = 99,
            bestSize = 0,
            bestClusterCount = 0,
            bestBiggestSize = 1200,
            bestGrowth = 0

        function analyseCluster(){
            loadData(index, 0)
                .then(function(){
                    return $scope.apply(true)
                })
                .then(function(){
                    var allDists = {},
                        avgRating = 0,
                        clusterCount = [],
                        sum = 0

                    //Calculate number of covered companies
                    var numberOfCompanies = 0
                    for(var i=0; i < $scope.nodes.length ; i++){
                        if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].companies).length > 0) {
                            numberOfCompanies += $scope.nodes[i].values.length
                        }
                    }

                    for(var i=0; i < $scope.nodes.length ; i++){
                        if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].companies).length > 0) {
                            allDists[i] = generateStatsForNode($scope.nodes[i])
                            avgRating += clusterRating(allDists[i]) * ($scope.nodes[i].values.length / numberOfCompanies)
                            clusterCount.push($scope.nodes[i].values.length)
                            sum += $scope.nodes[i].values.length
                        }
                    }
                    clusterCount.sort(function (a, b) {
                        return b - a
                    })

                    $scope.avgRating = avgRating

                    var overallStats = generateOverallStats(allDists)
                    overallStats = sortOnKeys(overallStats)
                    for(var product in overallStats){
                        if(product.toLowerCase() != "undefined")
                            $scope.overallClusterStats[product] = {
                                percent: Math.round(overallStats[product]),
                                color: productColor(product)
                            }
                    }

                    var avgHighest = Math.round(getHighestAvg(allDists))

                    var allGrowth = {}

                    for(var i=0; i < $scope.nodes.length ; i++){
                        if($scope.nodes[i].values.length > 1 && Object.keys($scope.nodes[i].products).length > 0) {
                            allGrowth[i] = generateDemandGrowth($scope.nodes[i])
                        }
                    }

                    var generalGrowth = overallGrowth(allGrowth)

                    if(bestRating != 0 && clusterCount.length >= 3 ){
                        if(avgRating < bestRating){
                            bestRating = avgRating
                            bestLevel = index
                            bestSize = sum
                            bestClusterCount = clusterCount.length
                            bestBiggestSize = clusterCount[0]
                            bestGrowth = generalGrowth.avg
                            console.log("+++++++++++++++++++  ++++++++++++++  Best Level " + index + " ++++++++++ +++++++")
                        }
                    }
                    //else{
                    //    bestRating = avgRating
                    //    bestLevel = index
                    //    bestSize = sum
                    //    bestClusterCount = clusterCount.length
                    //}


                    console.log("***************************** LEVEL " + index + " **********************************" +
                                "\nAverage Rating: " + avgRating + "\nAverage Highest: " + avgHighest + "\nCount of Cluster: " +
                                clusterCount.length + "\nBiggest size: " + clusterCount[0] + "\nAverage Size: " + sum/clusterCount.length +
                                "\nAverage Growths: " + generalGrowth.avg + "\n#-Companies: " + sum)
                    index+=1

                    if(index < treeDepth)
                        analyseCluster()
                    else {
                        loadData(bestLevel, 200)
                            .then($scope.apply)
                        console.log("Best Level: " + bestLevel)
                    }
                })
        }

        analyseCluster()

    }

    function clusterHasCompany(companyId, cluster){
        for(var i=0; i<cluster.values.length; i++){
            if(cluster.values[i].value.crunchbase__uuid && cluster.values[i].value.crunchbase_uuid == companyId)
                return true
            else if(cluster.values[i].value.linkedin_id && cluster.values[i].value.linkedin_id == companyId)
                return true
        }
        return false
    }

    function generateStatsForNode(node){
        var productDist = {},
            companyCount = node.values.length

        for(var companyId in node.companies){

            for(var product in node.companies[companyId]){
                if(productDist[product]){
                    productDist[product] += 1
                }else{
                    productDist[product] = 1
                }
            }

        }

        for(var product in productDist){
            if(node.products[product].count > 1){
                var percent = (productDist[product] / companyCount) * 100
                productDist[product] = percent
            }else{
                delete productDist[product]
            }
        }

        return productDist
    }

    function generateOverallStats(nodeStats){
        var productSum = {},
            productCount = {}

        for(var index in nodeStats){

            for(var product in nodeStats[index]){
                if(productSum[product]){
                    productSum[product] += nodeStats[index][product]
                }else{
                    productSum[product] = nodeStats[index][product]
                }
                if(productCount[product]){
                    productCount[product] += 1
                }else{
                    productCount[product] = 1
                }
            }
        }

        for(var product in productSum){

            //$scope.nodes[i]
            var average = (productSum[product] / productCount[product])
            productSum[product] = average
        }

        return productSum
    }

    function generateDemandGrowth(node){
        var productGrowths = {},
            avg = 0,
            count = 0

        for(var product in node.products){
            if(product != "undefined"){
                var countDays = ( (node.products[product].dates[node.products[product].dates.length-1] - node.products[product].dates[0]) / (1000*60*60*24) )
                if(countDays > 1)
                    productGrowths[product] = Math.round( (node.products[product].count / countDays) *1000) / 1000
                else
                    productGrowths[product] = 0
                avg += productGrowths[product]
                count++
            }
        }

        productGrowths.avg = Math.round( (avg/count)*1000) / 1000

        return productGrowths
    }

    function overallGrowth(nodeGrowths){
        var growths = {},
            productCount = {}
        for(var company in nodeGrowths){
            for(var product in nodeGrowths[company]){
                if(growths[product]){
                    growths[product] += nodeGrowths[company][product]
                    productCount[product] += 1
                }else{
                    growths[product] = nodeGrowths[company][product]
                    productCount[product] = 1
                }

            }
        }

        for(var product in growths){
            growths[product] = growths[product] / productCount[product]
        }

        return growths
    }

    function getHighestAvg(nodeStats){
        var highSum = 0

        for(var index in nodeStats){
            var highest = 0

            for(var product in nodeStats[index]){
                if(nodeStats[index][product] > highest){
                    highest = nodeStats[index][product]
                }
            }
            highSum += highest

        }

        return highSum / Object.keys(nodeStats).length
    }

    function clusterRating(nodeStats) {
        var sum = 0,
            highest = 0,
            avg = 0,
            avgWithoutHighest = -1,
            values = [],
            rating = -1

        for (var product in nodeStats) {
            if (nodeStats[product] > highest)
                highest = nodeStats[product]

            sum = nodeStats[product]
            values.push(nodeStats[product])
        }

        values.sort(function (a, b) {
            return b - a
        })

        avg = sum / Object.keys(nodeStats).length

        if (Object.keys(nodeStats).length > 1){
            avgWithoutHighest = (sum - highest) / (Object.keys(nodeStats).length - 1)

            if(highest == avg)
                rating = 1
            else {
                var zaehler = (values[1] - avgWithoutHighest)
                rating =  Math.max(zaehler, 1) / (highest - avg)
            }
        }else
            rating = (100 - highest) / 100

        return rating
    }

    function sortOnKeys(dict) {

        var sorted = [];
        for(var key in dict) {
            sorted[sorted.length] = key;
        }
        sorted.sort();

        var tempDict = {};
        for(var i = 0; i < sorted.length; i++) {
            tempDict[sorted[i]] = dict[sorted[i]];
        }

        return tempDict;
    }

}])