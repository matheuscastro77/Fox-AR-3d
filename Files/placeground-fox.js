export const placegroundScenePipelineModule = () => {
  const modelFile = require('./assets/Fox.glb')

  const raycaster = new THREE.Raycaster()
  const tapPosition = new THREE.Vector2()
  const loader = new THREE.GLTFLoader()

  let surface

  const initXrScene = ({scene, camera, renderer}) => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const light = new THREE.DirectionalLight(0xffffff, 1, 100)
    light.position.set(1, 4.3, 2.5)

    scene.add(light)
    scene.add(new THREE.AmbientLight(0x404040, 5))

    light.shadow.mapSize.width = 1024
    light.shadow.mapSize.height = 1024
    light.shadow.camera.near = 0.5
    light.shadow.camera.far = 500
    light.castShadow = true

    surface = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 1, 1),
      new THREE.ShadowMaterial({
        opacity: 0.5,
      })
    )

    surface.rotateX(-Math.PI / 2)
    surface.position.set(0, 0, 0)
    surface.receiveShadow = true
    scene.add(surface)

    camera.position.set(0, 3, 0)
  }

  const mixers = []
  function randomNumberInterval(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a
  }

  const animateIn = (model, pointX, pointZ, yDegrees) => {
    model.scene.rotation.set(0.0, yDegrees, 0.0)
    model.scene.position.set(pointX, 0.0, pointZ)
    model.scene.scale.set(0.015, 0.015, 0.015)
    model.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
      }
    })
    const mixer = new THREE.AnimationMixer(model.scene)
    mixers.push(mixer)
    const action = mixer.clipAction(model.animations[randomNumberInterval(0, 2)])
    action.play()
    XR8.Threejs.xrScene().scene.add(model.scene)
  }

  const placeObject = (pointX, pointZ) => {
    loader.load(
      modelFile,
      (gltf) => {
        animateIn(gltf, pointX, pointZ, Math.random() * 360)
      }
    )
  }

  const placeObjectTouchHandler = (e) => {
    if (e.touches.length === 2) {
      XR8.XrController.recenter()
    }

    if (e.touches.length > 2) {
      return
    }

    const {scene, camera} = XR8.Threejs.xrScene()

    tapPosition.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1
    tapPosition.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(tapPosition, camera)

    const intersects = raycaster.intersectObject(surface)

    if (intersects.length === 1 && intersects[0].object === surface) {
      placeObject(intersects[0].point.x, intersects[0].point.z)
    }
  }

  return {
    name: 'placeground',

    onStart: ({canvas, canvasWidth, canvasHeight}) => {
      const {scene, camera, renderer} = XR8.Threejs.xrScene()

      initXrScene({scene, camera, renderer})

      canvas.addEventListener('touchstart', placeObjectTouchHandler, true)

      canvas.addEventListener('touchmove', (event) => {
        event.preventDefault()
      })

      const clock = new THREE.Clock()
      let previousTime = 0

      const tick = () => {
        const elapsedTime = clock.getElapsedTime()
        const deltaTime = elapsedTime - previousTime
        previousTime = elapsedTime

        if (mixers.length) {
          mixers.forEach((m) => {
            m.update(deltaTime)
          })
        }

        renderer.render(scene, camera)

        window.requestAnimationFrame(tick)
      }

      tick()

      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })
    },
  }
}
