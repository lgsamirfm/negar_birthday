import { Component, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Center, Clone, useGLTF } from "@react-three/drei";
import { heroFit, heroModels, heroSceneDebug } from "./heroModels";

/* ------------------------------------------------------------------ *
 * Small helpers so src/heroModels.js stays pleasant to edit
 * ------------------------------------------------------------------ */
const DEG_TO_RAD = Math.PI / 180;

// Accepts either a single number (uniform) or an [x, y, z] array.
const asVec3 = (value, fallback) =>
  Array.isArray(value) ? value : value == null ? fallback : [value, value, value];

// Config rotations are written in degrees because that is how people think.
const asRadians = (value) => asVec3(value, [0, 0, 0]).map((deg) => deg * DEG_TO_RAD);

const isVisible = (model) => model.visible !== false && Boolean(model.src);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// On small screens a model's `narrow` block replaces its normal values, so
// the arrangement can be compacted rather than only shrunk.
const resolveModel = (model, narrow) =>
  narrow && model.narrow ? { ...model, ...model.narrow } : model;

/**
 * How much to shrink the whole arrangement.
 *
 * The camera's fov is vertical, so the visible world height is the same on
 * every device — it is the visible WIDTH that changes, and it is exactly
 * proportional to the canvas aspect ratio. Dividing the live aspect by the
 * aspect the scene was designed for therefore keeps the composition taking up
 * the same slice of the width on any screen. maxScale of 1 means wide desktop
 * canvases are never enlarged, so the tuned desktop look is left alone.
 */
function fitScale(aspect) {
  if (!heroFit.enabled) return 1;
  return clamp(aspect / heroFit.referenceAspect, heroFit.minScale, heroFit.maxScale);
}

/* ------------------------------------------------------------------ *
 * Model entrance animation
 *
 * WebGL has no such thing as per-object opacity, so a model can only fade in
 * through its own materials. Turning `transparent` on makes three.js compile a
 * different shader program, which is why every change is paired with
 * `needsUpdate`, and why the file's original settings are put back the moment
 * the fade finishes — the model ends up rendering exactly as it would have
 * with no animation at all.
 *
 * The materials belong to the shared GLTF cache, so only their *properties*
 * are ever touched, never the reference: swapping `node.material` for a clone
 * would just be overwritten the next time R3F re-applies the prop.
 * ------------------------------------------------------------------ */
const MODEL_FADE_SECONDS = 0.9;
const MODEL_STAGGER_SECONDS = 0.12;
const MODEL_RISE_UNITS = 0.06; // the whole visible world is under 1 unit tall

const easeOutCubic = (value) => 1 - (1 - value) ** 3;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One step of the fade, applied to every material this model owns.
 *
 * Kept at module scope on purpose. eslint's react-hooks/immutability analyses a
 * useFrame callback as if it ran during render, and refuses writes to anything
 * reachable from a hook result — which every material here is, since they come
 * out of useGLTF. A plain function's own parameters are not render values, so
 * doing the write here is both allowed and honest about what is happening: we
 * are driving a three.js scene graph, not React state.
 */
function applyFade(materials, eased) {
  for (const material of materials) {
    const original = material.userData.heroFade;
    material.opacity = eased * (original ? original.opacity : 1);
  }
}

// Put a material back the way the .glb shipped it, and forget we touched it.
function restoreMaterial(material) {
  const original = material.userData.heroFade;
  if (!original) return;
  material.transparent = original.transparent;
  material.opacity = original.opacity;
  material.needsUpdate = true;
  delete material.userData.heroFade;
}

// Start fetching every model right away instead of waiting for each
// component to mount and suspend.
heroModels.forEach((model) => {
  if (isVisible(model)) useGLTF.preload(model.src);
});

/* ------------------------------------------------------------------ *
 * One entry in heroModels -> one model in the scene
 * ------------------------------------------------------------------ */
function HeroModel({ model, index }) {
  const spinRef = useRef(null);
  const riseRef = useRef(null);
  const { scene } = useGLTF(model.src);

  // The animation state lives on the rise group's own userData rather than in a
  // useRef object. That is not just tidiness: the React Compiler freezes
  // anything created in render scope, so mutating a state object hanging off a
  // ref is rejected, while mutation through a ref that is attached to a real
  // node (as spinRef already does) is exactly what it expects.
  useLayoutEffect(() => {
    const holder = riseRef.current;
    if (!holder) return undefined;

    if (prefersReducedMotion()) {
      holder.userData.heroFade = { elapsed: 0, materials: [], done: true };
      return undefined;
    }

    // Hide the model before the first frame paints it, otherwise it flashes at
    // full opacity for one frame and then jumps back to invisible.
    const materials = [];
    scene.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (materials.includes(material)) continue;
        materials.push(material);
        material.userData.heroFade = {
          transparent: material.transparent,
          opacity: material.opacity,
        };
        material.transparent = true;
        material.opacity = 0;
        material.needsUpdate = true;
      }
    });

    // A negative `elapsed` is the stagger: the model simply waits its turn.
    holder.userData.heroFade = {
      elapsed: -index * MODEL_STAGGER_SECONDS,
      materials,
      done: false,
    };

    // The cleanup closes over the local `materials`, not over the holder, which
    // by unmount time may already have been handed to another render.
    return () => {
      // Unmounting mid-fade (or a hot reload) must not leave the shared cache
      // half-invisible for whatever mounts next.
      for (const material of materials) restoreMaterial(material);
      delete holder.userData.heroFade;
    };
  }, [index, scene]);

  useFrame((_, delta) => {
    if (spinRef.current && model.spin) {
      spinRef.current.rotation.y += delta * model.spin; // spin speed on Y-axis
    }

    const holder = riseRef.current;
    const fade = holder && holder.userData.heroFade;
    if (!fade || fade.done) return;

    fade.elapsed += delta;
    if (fade.elapsed < 0) return; // still waiting for its stagger slot

    const progress = Math.min(fade.elapsed / MODEL_FADE_SECONDS, 1);
    const eased = easeOutCubic(progress);

    applyFade(fade.materials, eased);

    // Rise into place from just below, echoing the headline's entrance.
    holder.position.y = -(1 - eased) * MODEL_RISE_UNITS;

    if (progress >= 1) {
      fade.done = true;
      for (const material of fade.materials) restoreMaterial(material);
      holder.position.y = 0;
    }
  });

  return (
    <group position={asVec3(model.position, [0, 0, 0])}>
      {/* The entrance offset sits on its own group, so the config's `position`
          stays the model's resting place and the animation only ever moves it
          relative to zero. */}
      <group ref={riseRef}>
        {/* The spin wraps <Center>, and that order matters. <Center> slides the
            geometry so its middle sits on `position`, so rotating here turns the
            model around its own middle. A spinning node *inside* <Center> would
            instead orbit the file's origin — fine for the cake, but a balloon
            whose origin is at the end of its string would swing in a circle. */}
        <group ref={spinRef}>
          {/* Pass center: false in the config to keep the file's own origin. */}
          <Center disable={model.center === false}>
            {/* <Clone> rather than <primitive>: it rebuilds the loaded scene as
                its own nodes, so the same .glb can appear in the config twice
                without two React nodes fighting over one three.js object (an
                Object3D can only have one parent). Skinned/animated models are
                handled too — Clone switches to SkeletonUtils for those. */}
            <Clone
              object={scene}
              scale={asVec3(model.scale, [1, 1, 1])}
              rotation={asRadians(model.rotation)}
            />
          </Center>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * One bad path in heroModels.js should not blank the whole hero
 * ------------------------------------------------------------------ */
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn(
      `[hero] Could not load the model "${this.props.label}". Check its "src" in src/heroModels.js and that the file exists in public/.`,
      error,
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Fallback shown while a model downloads. Kept small on purpose: the hero's
// visible world is under 1 unit tall, so a full-size box would fill the screen.
function ModelLoaderPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshBasicMaterial color="#f472b6" wireframe />
    </mesh>
  );
}

// Opt-in helpers for placing models: a grid on the ground plane plus the
// world axes (red = x, green = y, blue = z). Toggle in src/heroModels.js.
function SceneDebug() {
  return (
    <>
      <gridHelper args={[2, 20, "#f9a8d4", "#fecdd3"]} />
      <axesHelper args={[0.8]} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Everything inside <Canvas>: lights, debug gizmos and the model stage.
 * Lives in its own component because useThree only works under a Canvas.
 * ------------------------------------------------------------------ */
function HeroScene() {
  // Selecting the two numbers rather than the `size` object: primitives always
  // trigger a re-render on resize, whatever R3F does with the object identity.
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const aspect = width / Math.max(height, 1);
  const narrow = heroFit.enabled && aspect < heroFit.narrowAspect;
  const stageScale = fitScale(aspect);

  // Read these numbers off the console to calibrate referenceAspect.
  useEffect(() => {
    if (!heroSceneDebug) return;
    console.info(
      `[hero] canvas ${Math.round(width)}×${Math.round(height)}px · aspect ${aspect.toFixed(2)} · ` +
        `stage scale ${stageScale.toFixed(2)}${narrow ? " · narrow overrides ON" : ""}`,
    );
  }, [aspect, narrow, height, width, stageScale]);

  const models = heroModels.map((model) => resolveModel(model, narrow)).filter(isVisible);

  return (
    <>
      {/* Deliberately outside the stage group: the gizmo shows true,
          unscaled world units so you can see how much room there really is. */}
      {heroSceneDebug && <SceneDebug />}

      {/* One group holds every model, so scaling it shrinks the models AND
          their positions together. The arrangement stays centred on the
          camera's target instead of drifting or clipping at the edges. */}
      <group scale={stageScale}>
        {/* Each model gets its own Suspense + error boundary, so they appear
            one by one as they load and one broken path can't take the rest of
            the scene down with it. */}
        {models.map((model, index) => (
          <ModelErrorBoundary key={model.id} label={model.id}>
            <Suspense fallback={<ModelLoaderPlaceholder />}>
              <HeroModel model={model} index={index} />
            </Suspense>
          </ModelErrorBoundary>
        ))}
      </group>
    </>
  );
}

function Hero() {
  return (
    <div className="relative flex p-6 flex-col items-center justify-between min-h-screen text-center overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45vw] h-[45vw] bg-rose-200/40 rounded-full blur-[100px] pointer-events-none" />

      {/* 1. Header Typography
          Each line rises in on its own beat; the delays are short enough to
          read as one motion rather than a slideshow. */}
      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center gap-3 pt-6 pb-2">
        <span className="rise-in [animation-delay:80ms] px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-xs font-bold shadow-sm">
         تولدددددددددددددد
        </span>
        <h1 className="rise-in [animation-delay:200ms] text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text text-transparent drop-shadow-sm pb-1">
          تولدت مبارک نگاررررر
        </h1>
        {/* <p className="rise-in [animation-delay:320ms] text-gray-500 font-medium text-sm sm:text-base max-w-md leading-loose">
          یک گوشه‌ی دنج دیجیتال، فقط برای جشن گرفتن تو.
        </p> */}
      </div>

      {/* 2. Interactive 3D Canvas — renders every model in src/heroModels.js */}
      <div className="w-full flex-1 relative min-h-[350px] flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing">
          <Canvas camera={{ position: [0, 0.5, 1], fov: 45 }}>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <directionalLight position={[-5, 5, -5]} intensity={0.6} color="#c084fc" />
            <pointLight position={[0, -3, 2]} intensity={0.8} />

            <HeroScene />
          </Canvas>
        </div>
      </div>

      {/* 3. Bottom Bounce Indicator
          Two nested divs on purpose: `animate-bounce` and `.rise-in` both own
          the `animation` property, so sharing one element would mean whichever
          rule wins kills the other. The outer one handles the entrance, the
          inner one keeps bouncing forever after. */}
      <div className="relative z-10 mb-2 rise-in [animation-delay:1000ms]">
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <p className="text-xs font-bold text-rose-400">
            پیام‌هامونو بخون
          </p>
          <svg 
            className="w-5 h-5 text-rose-400" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>
      
    </div>
  );
}

export default Hero;