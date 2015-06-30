graphAnalyser.provider('ba_graphProvider', function(){

    function _graphProvider($http, $q) {
        this.graphData = function(){
            var deferred = $q.defer()

            //$http.get("/data.json", [])
            //    .success(function(data){
            //        deferred.resolve(data)
            //    })

            $http.get("/api/graph", [])
                .success(function(data){
                    deferred.resolve(data)
                })

            return deferred.promise
        }

    }

    this.$get = ['$http','$q', function($http, $q) {
        return new _graphProvider($http, $q);
    }];

})

