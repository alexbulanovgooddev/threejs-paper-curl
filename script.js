import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders.js";

const lenis = new Lenis();

lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

gsap.registerPlugin(ScrollTrigger);

const container = document.querySelector(".hero-image-container");

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  premultipliedAlpha: false,
});
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const canvas = renderer.domElement;
canvas.classList.add("hero-canvas");
container.appendChild(canvas);

const uniforms = {
  uTexture: { value: null },
  uImageSize: { value: new THREE.Vector2(1, 1) },
  uPlaneSize: { value: new THREE.Vector2(1, 1) },
  uPad: { value: new THREE.Vector2(0.25, 0.25) },
  uProgress: { value: 0 },
};

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  transparent: true,
});
scene.add(new THREE.Mesh(geometry, material));

gsap.ticker.add(() => renderer.render(scene, camera));

new THREE.TextureLoader().load("./images/image-01.jpg", (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  uniforms.uTexture.value = texture;
  uniforms.uImageSize.value.set(texture.image.width, texture.image.height);
});

const SCALE = 1 / (1 - 2 * uniforms.uPad.value.x);

function resize() {
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const w = rect.width * SCALE;
  const h = rect.height * SCALE;

  renderer.setSize(w, h, false); // pixelRatio применится сам
  uniforms.uPlaneSize.value.set(w, h); // размер всей плоскости, а не страницы
}

resize();
window.addEventListener("resize", resize);

ScrollTrigger.create({
  trigger: ".hero",
  start: "top top",
  end: "+=85%",
  scrub: true,
  pin: true,
  onUpdate: (self) => (uniforms.uProgress.value = self.progress),
});
