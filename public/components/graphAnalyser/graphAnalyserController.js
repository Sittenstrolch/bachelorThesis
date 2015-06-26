var graphAnalyser = angular.module('graphAnalyser', [])

graphAnalyser.controller("graphAnalyserCtrl", ['$scope', 'ba_graphProvider', '$interval', function($scope, graphProvider, $interval){
    var graphSpace = angular.element(document.getElementsByClassName('graphSpace')[0]),
        header = angular.element(document.getElementsByClassName('graphHeader')[0]),
        interval = null

    //Scope variables
    $scope.width = graphSpace[0].offsetWidth;
    $scope.height = graphSpace[0].offsetHeight - header[0].offsetHeight;
    $scope.showDetails = false
    $scope.companyDetail = {
        name: "Apple",
        logo: "http://logok.org/wp-content/uploads/2014/04/Apple-Logo-rainbow.png",
        employeesMin: 20,
        employeesMax: 500,
        link: "http://www.apple.com"
    }

    var color = d3.scale.category20()

    var force = d3.layout.force()
        .charge(-120)
        .linkDistance(50)
        .size([$scope.width, $scope.height]);

    graphProvider.graphData()
        .then(function(graph){
            $scope.nodes = graph.nodes;
            $scope.links = graph.links;

            for(var i=0; i < $scope.links.length ; i++){
                $scope.links[i].strokeWidth = Math.round($scope.links[i].value)
            }

            for(var i=0; i < $scope.nodes.length ; i++){
                $scope.nodes[i].color = color($scope.nodes[i].group)
            }

            force
                .nodes($scope.nodes)
                .links($scope.links)
                .on("tick", function(){$scope.$apply()})
                .start();

            interval = $interval(function(){
                var changed = false
                for(var i=0; i<$scope.nodes.length; i++){
                    var node = $scope.nodes[i]
                    if(node.y < 0) {
                        node.y = 15
                        changed = true
                    }else if(node.y > $scope.height){
                        node.y = $scope.height - 20
                        changed = true
                    }
                }
                if(!changed)
                    $interval.cancel(interval)
            }, 5000)
        })



    $scope.displayInfo = function(node){
        $scope.showDetail = true
        console.log(node)
    }

    $scope.zoomToDetail = function(){
        console.log("Display company with connected companies")
    }

}])