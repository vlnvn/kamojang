import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type Action = "left" | "right" | "up" | "down" | "in" | "out" | "reset";
type Metrics = {
  load_ms: number;
  triangles: number;
  draw_calls: number;
  geometries: number;
  textures: number;
  dpr: number;
  renderer: string;
  active_viewers: number;
};
let activeViewers = 0;
export function viewerResources() {
  return { active_viewers: activeViewers };
}
function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    if (object instanceof THREE.Light && "shadow" in object)
      (object.shadow as THREE.LightShadow | undefined)?.dispose();
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) {
    const source = texture.source.data;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)
      source.close();
    texture.dispose();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
export default function TurbineViewer() {
  const host = useRef<HTMLDivElement>(null);
  const action = useRef<(a: Action) => void>(() => {});
  const rotate = useRef(false);
  const startOrbit = useRef<() => void>(() => {});
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error" | "static">(
    "loading",
  );
  const [message, setMessage] = useState("Membaca mesh dan tekstur turbin…");
  const [moving, setMoving] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    rotate.current = moving;
    if (moving) startOrbit.current();
  }, [moving]);
  useEffect(() => {
    if (state === "static") return;
    const element = host.current!;
    let alive = true;
    let raf = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let root: THREE.Object3D | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let scene: THREE.Scene | undefined;
    let resize: ResizeObserver | undefined;
    let previous = 0;
    let removeListeners = () => {};
    let counted = false;
    const controller = new AbortController();
    const start = performance.now();
    const fail = (text: string) => {
      if (alive) {
        rotate.current = false;
        setMoving(false);
        setMessage(text);
        setState("error");
      }
    };
    const loadTimeout = window.setTimeout(() => {
      fail("Pemuatan model melewati 45 detik. Coba lagi atau gunakan gambar.");
      controller.abort();
    }, 45000);
    const setup = async () => {
      try {
        const canvas = document.createElement("canvas");
        if (
          !canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false })
        )
          throw Error("unsupported");
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
        });
        activeViewers++;
        counted = true;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        canvas.setAttribute("aria-label", "Mesh turbin uap representatif");
        element.append(canvas);
        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
        const pmrem = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        environment = pmrem.fromScene(room, 0.04);
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.75;
        room.dispose();
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x183a2d, 2));
        const light = new THREE.DirectionalLight(0xffedda, 3.5);
        light.position.set(4, 7, 5);
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.camera.left = -4;
        light.shadow.camera.right = 4;
        light.shadow.camera.top = 4;
        light.shadow.camera.bottom = -4;
        light.shadow.bias = -0.0002;
        scene.add(light);
        const fill = new THREE.DirectionalLight(0xb8e1d5, 2);
        fill.position.set(-4, 2, -3);
        scene.add(fill);
        controls = new OrbitControls(camera, canvas);
        controls.enablePan = false;
        controls.enableDamping = false;
        controls.minPolarAngle = 0.2;
        controls.maxPolarAngle = Math.PI * 0.54;
        const render = () => {
          if (alive && renderer && scene && !document.hidden) {
            renderer.render(scene, camera);
            element.dataset.camera = JSON.stringify(
              camera.position.toArray().map((n) => +n.toFixed(6)),
            );
            element.dataset.frames = String(renderer.info.render.frame);
          }
        };
        resize = new ResizeObserver(() => {
          if (!renderer) return;
          const { width, height } = element.getBoundingClientRect();
          renderer.setSize(Math.max(1, width), Math.max(1, height), false);
          camera.aspect = Math.max(1, width) / Math.max(1, height);
          camera.updateProjectionMatrix();
          render();
        });
        resize.observe(element);
        controls.addEventListener("change", render);
        const lost = (event: Event) => {
          event.preventDefault();
          fail("Konteks WebGL terputus. Muat ulang model atau gunakan gambar.");
        };
        const restored = () => {
          if (alive) {
            setState("loading");
            setAttempt((v) => v + 1);
          }
        };
        canvas.addEventListener("webglcontextlost", lost);
        canvas.addEventListener("webglcontextrestored", restored);
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const stop = () => {
          rotate.current = false;
          setMoving(false);
        };
        const motionChanged = () => {
          if (motion.matches) stop();
        };
        const visibility = () => {
          previous = 0;
          if (document.hidden) stop();
          else render();
        };
        motion.addEventListener("change", motionChanged);
        document.addEventListener("visibilitychange", visibility);
        removeListeners = () => {
          canvas.removeEventListener("webglcontextlost", lost);
          canvas.removeEventListener("webglcontextrestored", restored);
          motion.removeEventListener("change", motionChanged);
          document.removeEventListener("visibilitychange", visibility);
          controls?.removeEventListener("change", render);
        };
        const response = await fetch("/models/steam-turbine.glb", {
          signal: controller.signal,
        });
        if (!response.ok) throw Error(`http:${response.status}`);
        const bytes = await response.arrayBuffer();
        const loader = new GLTFLoader();
        const { MeshoptDecoder } =
          await import("three/addons/libs/meshopt_decoder.module.js");
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.parseAsync(bytes, "");
        if (!alive || controller.signal.aborted) {
          disposeObject(gltf.scene);
          return;
        }
        root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 3.5 / Math.max(size.x, size.y, size.z);
        root.scale.multiplyScalar(scale);
        root.position.sub(center.multiplyScalar(scale));
        root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        scene.add(root);
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(20, 20),
          new THREE.ShadowMaterial({ opacity: 0.22 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = new THREE.Box3().setFromObject(root).min.y - 0.025;
        ground.receiveShadow = true;
        scene.add(ground);
        const radius = new THREE.Box3()
          .setFromObject(root)
          .getBoundingSphere(new THREE.Sphere()).radius;
        const initial = new THREE.Vector3(1.3, 0.8, 1.8)
          .normalize()
          .multiplyScalar(radius * 3.0);
        camera.position.copy(initial);
        controls.minDistance = radius * 1.7;
        controls.maxDistance = radius * 6;
        controls.target.set(0, 0, 0);
        controls.update();
        action.current = (a) => {
          if (!controls) return;
          const offset = camera.position.clone().sub(controls.target);
          if (a === "reset") {
            camera.position.copy(initial);
            controls.target.set(0, 0, 0);
          } else if (a === "left" || a === "right") {
            offset.applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              a === "left" ? -0.22 : 0.22,
            );
            camera.position.copy(controls.target).add(offset);
          } else if (a === "up" || a === "down") {
            const spherical = new THREE.Spherical().setFromVector3(offset);
            spherical.phi = THREE.MathUtils.clamp(
              spherical.phi + (a === "up" ? -0.18 : 0.18),
              controls.minPolarAngle,
              controls.maxPolarAngle,
            );
            camera.position
              .copy(controls.target)
              .add(new THREE.Vector3().setFromSpherical(spherical));
          } else {
            const length = THREE.MathUtils.clamp(
              offset.length() * (a === "in" ? 0.85 : 1.18),
              controls.minDistance,
              controls.maxDistance,
            );
            camera.position.copy(controls.target).add(offset.setLength(length));
          }
          if (!controls.update()) render();
        };
        render();
        const gl = renderer.getContext();
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        setMetrics({
          load_ms: performance.now() - start,
          triangles: renderer.info.render.triangles,
          draw_calls: renderer.info.render.calls,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          dpr: renderer.getPixelRatio(),
          renderer: debug
            ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
            : "not exposed",
          active_viewers: activeViewers,
        });
        setState("ready");
        const tick = (now: number) => {
          raf = 0;
          if (!alive || !rotate.current || document.hidden) return;
          if (rotate.current && !document.hidden) {
            const dt = Math.min((now - (previous || now)) / 1000, 0.05);
            camera.position.applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              dt * 0.18,
            );
            controls?.update();
          }
          previous = now;
          raf = requestAnimationFrame(tick);
        };
        startOrbit.current = () => {
          if (!raf && alive) raf = requestAnimationFrame(tick);
        };
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        fail(
          error instanceof Error && error.message === "unsupported"
            ? "WebGL 2 tidak tersedia pada perangkat ini. Gambar turbin tetap dapat dilihat."
            : "Model 3D tidak dapat dimuat. Periksa berkas, decoder, atau koneksi lokal lalu coba lagi.",
        );
      } finally {
        window.clearTimeout(loadTimeout);
      }
    };
    window.queueMicrotask(() => {
      if (alive) void setup();
    });
    return () => {
      alive = false;
      window.clearTimeout(loadTimeout);
      controller.abort();
      cancelAnimationFrame(raf);
      resize?.disconnect();
      removeListeners();
      controls?.dispose();
      action.current = () => {};
      startOrbit.current = () => {};
      if (scene) disposeObject(scene);
      else if (root) disposeObject(root);
      environment?.dispose();
      if (renderer) {
        renderer.renderLists.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
      if (counted) activeViewers--;
    };
    // State changes from loading to ready/error do not recreate the GPU context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const retry = () => {
    setState("loading");
    setMetrics(null);
    setMessage("Membaca mesh dan tekstur turbin…");
    setMoving(false);
    setAttempt((v) => v + 1);
  };
  return (
    <div
      className="turbine-viewer"
      data-state={state}
      data-metrics={metrics ? JSON.stringify(metrics) : undefined}
    >
      <div
        ref={host}
        className="turbine-canvas"
        tabIndex={state === "ready" ? 0 : -1}
        role="group"
        aria-label="Inspeksi turbin 3D"
        aria-describedby="turbine-instructions"
        onKeyDown={(event) => {
          const key: { [key: string]: Action } = {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
            "+": "in",
            "=": "in",
            "-": "out",
            Home: "reset",
          };
          if (key[event.key]) {
            event.preventDefault();
            action.current(key[event.key]);
          }
        }}
      />
      {state !== "ready" && (
        <div className="turbine-status">
          {state !== "loading" && (
            <img
              src="/models/steam-turbine-poster.webp"
              alt="Render statis dari mesh Steam Turbine oleh landinweaver"
            />
          )}
          <p role={state === "error" ? "alert" : "status"}>
            {state === "static"
              ? "Mode gambar. Interaksi 3D dinonaktifkan."
              : message}
          </p>
          {state !== "loading" && (
            <button onClick={retry}>Muat ulang model</button>
          )}
          {(state === "error" || state === "loading") && (
            <button
              onClick={() => {
                setState("static");
                setAttempt((v) => v + 1);
              }}
            >
              Gunakan gambar
            </button>
          )}
        </div>
      )}
      {state === "ready" && (
        <div
          className="turbine-controls"
          role="group"
          aria-label="Kontrol turbin"
        >
          <button onClick={() => action.current("left")}>Putar kiri</button>
          <button onClick={() => action.current("right")}>Putar kanan</button>
          <button onClick={() => action.current("in")}>Dekatkan</button>
          <button onClick={() => action.current("out")}>Jauhkan</button>
          <button onClick={() => action.current("reset")}>Atur ulang</button>
          <button aria-pressed={moving} onClick={() => setMoving((v) => !v)}>
            {moving ? "Jeda orbit kamera" : "Mulai orbit kamera"}
          </button>
          <button
            onClick={() => {
              setMoving(false);
              setState("static");
              setAttempt((v) => v + 1);
            }}
          >
            Gunakan gambar
          </button>
        </div>
      )}
      <p id="turbine-instructions" className="turbine-instructions">
        Geser untuk memutar; cubit atau gulir untuk zoom. Keyboard: ← → ↑ ↓, +
        −, Home.
      </p>
    </div>
  );
}
