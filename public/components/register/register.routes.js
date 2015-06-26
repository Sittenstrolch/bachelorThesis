registration.config(['$stateProvider' ,function($stateProvider) {

    $stateProvider

        .state('registration', {
            url: '/registration',
            views: {
                '': {
                    controller: 'registrationCtrl',
                    templateUrl: 'components/register/registerDialog.html'
                }
            }
        })

        .state('registration.socialAccounts', {
            url: '/socialAccounts',
            views: {
                'registrationForm': {
                    templateUrl: 'components/register/form-socialAccounts.html'
                }
            }
        })

        .state('registration.account', {
            url: '/account',
            views: {
                'registrationForm': {
                    templateUrl: 'components/register/form-account.html'
                }
            }
        })

        .state('registration.territory', {
            views: {
                'registrationForm': {
                    templateUrl: 'components/register/form-territory.html'
                }
            }
        })

}]);