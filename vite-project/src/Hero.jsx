import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Center } from "@react-three/drei";

// The 3D component handling the imported asset
function ImportedModel() {
  const meshRef = useRef();

  // Load the model from your public directory path
  // Replace "model.glb" with your actual file name
  const { scene } = useGLTF("/strawberry_cake.glb");

  // Constant rotation loop
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4; // Spin speed on Y-axis
    }
  });

  return (
    <primitive 
      ref={meshRef} 
      object={scene} 
      // Scale down or up depending on the native size of your asset
      scale={7} 
    />
  );
}

// Fallback skeleton loader to show while the model downloads over the network
function ModelLoaderPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#f472b6" wireframe />
    </mesh>
  );
}

function Hero() {
  return (
    <div className="relative flex p-6 flex-col items-center justify-between min-h-screen text-center overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-200/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45vw] h-[45vw] bg-rose-200/40 rounded-full blur-[100px] pointer-events-none" />

      {/* 1. Header Typography */}
      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center gap-3 pt-6 pb-2">
        <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-xs font-semibold tracking-wider uppercase shadow-sm">
          Celebration
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text text-transparent drop-shadow-sm pb-1">
          Happy Birthday Negar!
        </h1>
        <p className="text-gray-500 font-medium text-sm sm:text-base max-w-md">
          A digital space made just to celebrate you.
        </p>
      </div>

      {/* 2. Interactive 3D Canvas Mesh Area */}
      <div className="w-full flex-1 relative min-h-[350px] flex items-center justify-center">
        <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing">
          <Canvas camera={{ position: [0, 0.5, 1], fov: 45 }}>
            <ambientLight intensity={1.2} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <directionalLight position={[-5, 5, -5]} intensity={0.6} color="#c084fc" />
            <pointLight position={[0, -3, 2]} intensity={0.8} />
            
            {/* Suspense is required when loading asynchronous 3D models */}
            <Suspense fallback={<ModelLoaderPlaceholder />}>
              {/* <Center> automatically centers the model geometry around the origin [0,0,0] */}
              <Center>
                <ImportedModel />
              </Center>
            </Suspense>
          </Canvas>
        </div>
      </div>

      {/* 3. Bottom Bounce Indicator */}
      <div className="relative z-10 flex flex-col items-center gap-2 mb-2 animate-bounce">
        <p className="text-xs text-right font-bold text-rose-400 tracking-widest uppercase">
          پیام هامونو بخون !
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
  );
}

export default Hero;
