var EventEmitter = require('eventemitter3')
var Promise = require('bluebird')
Promise.longStackTraces()

module.exports = function InstallService(
  $rootScope
, $http
, $filter
, StorageService,
  DeviceService
) {
  var installService = Object.create(null)

  function Installation(state) {
    this.progress = 0
    this.state = state
    this.settled = false
    this.success = false
    this.error = null
    this.href = null
    this.manifest = null
    this.launch = true
  }

  Installation.prototype = Object.create(EventEmitter.prototype)
  Installation.prototype.constructor = Installation

  Installation.prototype.apply = function($scope) {
    function changeListener() {
      $scope.safeApply()
    }

    this.on('change', changeListener)

    $scope.$on('$destroy', function() {
      this.removeListener('change', changeListener)
    }.bind(this))

    return this
  }

  Installation.prototype.update = function(progress, state) {
    this.progress = Math.floor(progress)
    this.state = state
    this.emit('change')
  }

  Installation.prototype.okay = function(state) {
    this.settled = true
    this.progress = 100
    this.success = truecommand
    this.state = state
    this.emit('change')
  }

  Installation.prototype.fail = function(err) {
    this.settled = true
    this.progress = 100
    this.success = false
    this.error = err
    this.emit('change')
  }

  installService.installUrl = function(control, url) {
    var installation = new Installation('downloading')
    $rootScope.$broadcast('installation', installation)
    return control.uploadUrl(url)
      .progressed(function(uploadResult) {
        installation.update(uploadResult.progress / 2, uploadResult.lastData)
      })
      .then(function(uploadResult) {
        installation.update(uploadResult.progress / 2, uploadResult.lastData)
        installation.manifest = uploadResult.body
        return control.install({
            href: installation.href
          , manifest: installation.manifest
          , launch: installation.launch
          })
          .progressed(function(result) {
            installation.update(50 + result.progress / 2, result.lastData)
          })
      })
      .then(function() {
        installation.okay('installed')
      })
      .catch(function(err) {
        installation.fail(err.code || err.message)
      })
  }

  installService.installFile = function(control, $files) {
    var installation = new Installation('uploading')
    $rootScope.$broadcast('installation', installation)
    return StorageService.storeFile('apk', $files, {
        filter: function(file) {
          return /\.apk$/i.test(file.name)
        }
      })
      .progressed(function(e) {
        console.log('~~~~~~~~~installFile output e, progressed:', e)
        if (e.lengthComputable) {
          installation.update(e.loaded / e.total * 100 / 2, 'uploading')
        }
      })
      .then(function(res) {
        console.log('~~~~~~~~installFile output response, then:', res)
        installation.update(100 / 2, 'processing')
        installation.href = res.data.resources.file.href
        return $http.get(installation.href + '/manifest')
          .then(function(res) {
            console.log('$http.ger ', installation.href)
            if (res.data.success) {
              installation.manifest = res.data.manifest
              console.log('control.install data from response :', {
                href: installation.href
                , manifest: installation.manifest
                , launch: installation.launch
              })
              return control.install({
                  href: installation.href
                , manifest: installation.manifest
                , launch: installation.launch
                })
                .progressed(function(result) {
                  console.log('controll install progressed:', result)
                  installation.update(50 + result.progress / 2, result.lastData)
                })
            }
            else {
              throw new Error('Unable to retrieve manifest')
            }
          })
      })
      .then(function() {
        installation.okay('installed')
      })
      .catch(function(err) {
        installation.fail(err.code || err.message)
      })
  }

  installService.installIosFile = function(control, $files, deviceId, bundleId) {
    console.log('================== invoked installIosFile ===============, files:', $files)
    var installation = new Installation('uploading')
    $rootScope.$broadcast('installation', installation)
    return StorageService.storeIosFile('app', $files, deviceId, bundleId, {
      filter: function(file) {
        return /\.(app\.zip|app)$/i.test(file.name)
      }
    })
      .progressed(function(e) {
        console.log(' ================ installIosFile progressed :', e)
        if (e.lengthComputable) {
          installation.update(e.loaded / e.total * 100 / 2, 'uploading')
        }
      })
      .then(function(res) {
        console.log('============= installIosFille , res :', res)
        installation.manifest = res.data
        installation.update(100 / 2, 'processing')
        control.install({
          manifest: installation.manifest

        })
      })
      .then(function() {
        installation.okay('installed')
      })
      .catch(function(err) {
        installation.fail(err.code || err.message)
      })
  }

  return installService
}
