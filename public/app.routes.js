ba.config(function($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/');
    
    $stateProvider
        
        // HOME STATES AND NESTED VIEWS ========================================
        .state('graphAnalyser', {
            url: '/',
            views: {
                '':{
                    controller: 'graphAnalyserCtrl',
                    templateUrl: 'components/graphAnalyser/graphAnalyserView.html'
                }
            }

        })
});