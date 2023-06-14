// Returns a pipeline module that initializes the threejs scene when the camera feed starts, and
// handles subsequent spawning of a glb model whenever the scene is tapped.

/* globals TWEEN */

export const placegroundScenePipelineModule = () => {
    const modelFile = require('./assets/Fox.glb')           // 3D model to spawn at tap
    const startScale = new THREE.Vector3(0.01, 0.01, 0.01)  // Initial scale value for our model
  
    const raycaster = new THREE.Raycaster()
    const tapPosition = new THREE.Vector2()
    const loader = new THREE.GLTFLoader()  // This comes from GLTFLoader.js.
  
    let surface  // Transparent surface for raycasting for object placement.
  
    // Populates some object into an XR scene and sets the initial camera position. The scene and
    // camera come from xr3js, and are only available in the camera loop lifecycle onStart() or later.
    const initXrScene = ({scene, camera, renderer}) => {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
  
      const light = new THREE.DirectionalLight(0xffffff, 1, 100)
      light.position.set(1, 4.3, 2.5)  // default
  
      scene.add(light)  // Add soft white light to the scene.
      scene.add(new THREE.AmbientLight(0x404040, 5))  // Add soft white light to the scene.
  
      light.shadow.mapSize.width = 1024  // default
      light.shadow.mapSize.height = 1024  // default
      light.shadow.camera.near = 0.5  // default
      light.shadow.camera.far = 500  // default
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
  
      // Set the initial camera position relative to the scene we just laid out. This must be at a
      // height greater than y=0.
      camera.position.set(0, 3, 0)
    }
  
    const animateIn = (model, pointX, pointZ, yDegrees) => {
      const scale = {...startScale}
  
      model.scene.rotation.set(0.0, yDegrees, 0.0)
      model.scene.position.set(pointX, 0.0, pointZ)
      model.scene.scale.set(0.01, 0.01, 0.01)
      model.scene.castShadow = true
      XR8.Threejs.xrScene().scene.add(model.scene)
    }
  
    let mixer = null
  
    // Load the glb model at the requested point on the surface.
    const placeObject = (pointX, pointZ) => {
      loader.load(
        modelFile,  // resource URL.
        (gltf) => {
          animateIn(gltf, pointX, pointZ, Math.random() * 360)
  
          function randomNumberInterval(a, b) {
            return Math.floor(Math.random() * (b - a + 1)) + a
          }
  
          mixer = new THREE.AnimationMixer(gltf.scene)
          const action = mixer.clipAction(gltf.animations[randomNumberInterval(0, 2)])
  
          action.play()
        }
      )
    }
  
    const placeObjectTouchHandler = (e) => {
      // Call XrController.recenter() when the canvas is tapped with two fingers. This resets the
      // AR camera to the position specified by XrController.updateCameraProjectionMatrix() above.
      if (e.touches.length === 2) {
        XR8.XrController.recenter()
      }
  
      if (e.touches.length > 2) {
        return
      }
  
      // If the canvas is tapped with one finger and hits the "surface", spawn an object.
      const {scene, camera} = XR8.Threejs.xrScene()
  
      // calculate tap position in normalized device coordinates (-1 to +1) for both components.
      tapPosition.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1
      tapPosition.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1
  
      // Update the picking ray with the camera and tap position.
      raycaster.setFromCamera(tapPosition, camera)
  
      // Raycast against the "surface" object.
      const intersects = raycaster.intersectObject(surface)
  
      if (intersects.length === 1 && intersects[0].object === surface) {
        placeObject(intersects[0].point.x, intersects[0].point.z)
      }
    }
  
    return {
      // Pipeline modules need a name. It can be whatever you want but must be unique within your app.
      name: 'placeground',
  
      // onStart is called once when the camera feed begins. In this case, we need to wait for the
      // XR8.Threejs scene to be ready before we can access it to add content. It was created in
      // XR8.Threejs.pipelineModule()'s onStart method.
      onStart: ({canvas, canvasWidth, canvasHeight}) => {
        const {scene, camera, renderer} = XR8.Threejs.xrScene()  // Get the 3js sceen from xr3js.
  
        // Add objects to the scene and set starting camera position.
        initXrScene({scene, camera, renderer})
  
        canvas.addEventListener('touchstart', placeObjectTouchHandler, true)  // Add touch listener.
  
        // prevent scroll/pinch gestures on canvas
        canvas.addEventListener('touchmove', (event) => {
          event.preventDefault()
        })
  
        const clock = new THREE.Clock()
        let previousTime = 0
  
        const tick = () => {
          const elapsedTime = clock.getElapsedTime()
          const deltaTime = elapsedTime - previousTime
          previousTime = elapsedTime
  
          // Update Mixer
          if (mixer != null) {
              mixer?.update(deltaTime)
          }
  
          // Render
          renderer.render(scene, camera)
  
          // Call tick again on the next frame
          window.requestAnimationFrame(tick)
        }
  
        tick()
  
        // Sync the xr controller's 6DoF position and camera paremeters with our scene.
        XR8.XrController.updateCameraProjectionMatrix({
          origin: camera.position,
          facing: camera.quaternion,
        })
      },
    }
  }
  