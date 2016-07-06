/**
 * Authentication Controller
 */
window.safeLauncher.controller('authController', [ '$scope', '$state', '$rootScope', '$timeout',
  'authFactory', 'fieldValidator', 'CONSTANTS', 'MESSAGES',
  function($scope, $state, $rootScope, $timeout, auth, validator, CONSTANTS, MESSAGES) {
    var REQUEST_TIMEOUT = 90 * 1000;
    var FIELD_FOCUS_DELAY = 100;

    $scope.user = {};
    $scope.formError = null;

    // handle authorisation before user logged-in
    auth.onAuthorisationReq(function(payload) {
      if (!$rootScope.isAuthenticated) {
        auth.confirmAuthorisation(payload, false);
      }
    });

    // registration tabbing
    $scope.tabs = {
      state: [ 'PIN', 'KEYWORD', 'PASSWORD' ],
      currentPos: null,
      init: function() {
        this.currentPos = this.state[0];
      },
      changePos: function(state) {
        if (state === this.state[0]) {
          this.currentPos = this.state[0];
          return;
        }
        if (state === this.state[1]) {
          $scope.validatePin();
          return;
        }
        if (state === this.state[2]) {
          if (!$scope.validatePin()) {
            return;
          }
          if (!$scope.validateKeyword()) {
            return;
          }
        }
      }
    };

    $scope.authLoader = {
      isLoading: false,
      error: false,
      show: function() {
        this.isLoading = true;
      },
      hide: function() {
        this.isLoading = false;
        this.error = false;
      }
    };

    var Request = function(callback) {
      var self = this;
      var alive = true;
      var timer;

      var onResponse = function(err) {
        if (!alive) {
          return;
        }
        alive = false;
        $scope.authLoader.hide();
        callback(err);
        $timeout.cancel(timer);
      };

      self.cancel = function() {
        onResponse(new Error('Request cancelled'));
        alive = false;
      };

      self.execute = function(func) {
        $scope.authLoader.show();
        timer = $timeout(function() {
          onResponse(new Error('Operation timed out'));
          alive = false;
        }, REQUEST_TIMEOUT);
        func(onResponse);
      };
    };

    var onAuthResponse = function(err) {
      $scope.user = {};
      if (err) {
        $scope.authLoader.error = true;
        $scope.authLoader.show();
        return $scope.$applyAsync();
      }
      $rootScope.network.hide();
      $state.go('user');
    };

    // register user
    var register = function() {
      var payload = {
        pin: $scope.user.pin,
        keyword: $scope.user.keyword,
        password: $scope.user.password
      };
      var request = new Request(onAuthResponse);
      $scope.cancelRequest = request.cancel;
      request.execute(function(done) {
        auth.register(payload, done);
      });
      $scope.tabs.init();
    };

    var getFormEle = function(form, field) {
      var formEle = $('form[name=' + form.$name + ']');
      return formEle.find('input[name=' + form[field].$name + ']');
    };

    // show form error
    var showFormError = function(err, form, field) {
      if (form && field) {
        var fieldEle = getFormEle(form, field);
        fieldEle.addClass('invalid');
        fieldEle.focus();
      }
      $scope.formError = err;
    };

    // hide form error
    var hideFormError = function(form, field) {
      if (form && field) {
        var fieldEle = getFormEle(form, field);
        fieldEle.removeClass('invalid');
      }
      $scope.formError = null;
    };

    // validate pin
    $scope.validatePin = function() {
      var errMsg = null;
      var formName = 'registerPin';

      if ($rootScope.network.status !== NETWORK_STATE.CONNECTED) {
        return showFormError(MESSAGES.NETWORK_NOT_CONNECTED);
      }
      errMsg = validator.validateField($scope.user.pin, validator.AUTH_FIELDS.PIN);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'pin');
      }
      hideFormError($scope[formName], 'pin');

      errMsg = validator.validateConfirmationField($scope.user.pin, $scope.user.confirmPin);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'confirmPin');
      }
      hideFormError($scope[formName], 'confirmPin');
      $scope.tabs.currentPos = $scope.tabs.state[1];
      $timeout(function() {
        $scope.focusField('registerKeyword', 'keyword');
      }, FIELD_FOCUS_DELAY);
      return true;
    };

    // validate keyword
    $scope.validateKeyword = function() {
      var errMsg = null;
      var formName = 'registerKeyword';

      errMsg = validator.validateField($scope.user.keyword, validator.AUTH_FIELDS.KEYWORD);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'keyword');
      }
      hideFormError($scope[formName], 'keyword');

      errMsg = validator.validateConfirmationField($scope.user.keyword, $scope.user.confirmKeyword);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'confirmKeyword');
      }
      hideFormError($scope[formName], 'confirmKeyword');
      $scope.tabs.currentPos = $scope.tabs.state[2];
      $timeout(function() {
        $scope.focusField('registerPassword', 'password');
      }, FIELD_FOCUS_DELAY);
      return true;
    };

    // validate password
    $scope.validatePassword = function() {
      var errMsg = null;
      var formName = 'registerPassword';
      errMsg = validator.validateField($scope.user.password, validator.AUTH_FIELDS.PASSWORD);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'password');
      }
      hideFormError($scope[formName], 'password');

      errMsg = validator.validateConfirmationField($scope.user.password, $scope.user.confirmPassword);
      if (errMsg) {
        return showFormError(errMsg, $scope[formName], 'confirmPassword');
      }
      hideFormError($scope[formName], 'confirmPassword');
      register();
      return true;
    };

    // user login
    $scope.login = function() {
      var inputParent = null;
      if (!$scope.loginForm.$valid) {
        var formEle = $('form[name=' + $scope.loginForm.$name + ']');
        var inputEle = formEle.find('input[name=' + $scope.loginForm.pin.$name + ']');
        inputParent = inputEle.parent();
        var msgEle = inputEle.siblings('.msg').children('.txt');
        var value = $scope.loginForm.pin.$viewValue;
        if (isNaN(value) || value.length < CONSTANTS.PIN_MIN_LEN) {
          inputParent.addClass('error').removeClass('warn');
          return msgEle.text(MESSAGES.PIN_MUST_BE_FOUR_CHAR_LONG_AND_NUM);
        }
        inputParent.removeClass('warn error');
        inputEle = formEle.find('input[name=' + $scope.loginForm.keyword.$name + ']');
        inputParent = inputEle.parent();
        msgEle = inputEle.siblings('.msg').children('.txt');
        value = $scope.loginForm.keyword.$viewValue;
        if (value.length < CONSTANTS.KEYWORD_MIN_LEN) {
          inputParent.addClass('error').removeClass('warn');
          return msgEle.text(MESSAGES.KEYWORD_MUST_BE_SIX_CHAR_LONG);
        }
        inputParent.removeClass('warn error');
        inputEle = formEle.find('input[name=' + $scope.loginForm.password.$name + ']');
        inputParent = inputEle.parent();
        msgEle = inputEle.siblings('.msg').children('.txt');
        value = $scope.loginForm.password.$viewValue;
        if (value.length < CONSTANTS.PASSWORD_MIN_LEN) {
          inputParent.addClass('error').removeClass('warn');
          return msgEle.text(MESSAGES.PASSWORD_MUST_BE_SIX_CHAR_LONG);
        }
        return;
      }
      inputParent.removeClass('error warn');
      console.log('login');
      return;
      var errMsg = null;
      var fieldName = null;
      var formFields = [
        validator.AUTH_FIELDS.PIN,
        validator.AUTH_FIELDS.KEYWORD,
        validator.AUTH_FIELDS.PASSWORD
      ];

      if ($rootScope.network.status !== NETWORK_STATE.CONNECTED) {
        return showFormError(MESSAGES.NETWORK_NOT_CONNECTED);
      }

      for (var i = 0; i < formFields.length; i++) {
        fieldName = formFields[i];
        errMsg = validator.validateField($scope.user[fieldName], fieldName);
        if (errMsg) {
          return showFormError(errMsg, $scope.mslLogin, fieldName);
        }
        hideFormError($scope.mslLogin, fieldName);
      }

      var request = new Request(onAuthResponse);
      $scope.cancelRequest = request.cancel;
      request.execute(function(done) {
        auth.login($scope.user, done);
      });
    };

    // reset input field
    $scope.resetInputField = function(model, $event) {
      var input = angular.element($event.target.previousElementSibling);
      if (input[0].nodeName !== 'INPUT') {
        return;
      }
      $scope.user[model] = null;
      input.removeClass('invalid');
      input.focus();
    };

    // focus field
    $scope.focusField = function(form, field) {
      var formEle = $('form[name="' + form + '"]');
      var input = formEle.find('input[name="' + field + '"]').focus();
      return true;
    };
  }
]);
