/**
 * ─────────────────────────────────────────────────────────────────────
 *  THE HERO'S 3D MODELS — edit this file, you never need to touch Hero.jsx
 * ─────────────────────────────────────────────────────────────────────
 * Every entry below becomes one model in the hero scene, with its own
 * position, scale, rotation and spin. Add as many as you like.
 *
 * HOW TO ADD A MODEL
 *   1. Drop the .glb / .gltf file into `public/`        e.g. public/balloon.glb
 *   2. Add an entry here with                            src: "/balloon.glb"
 *   3. Save — Vite hot-reloads, no restart needed.
 *
 * FIELDS
 *   id        unique name, used as the React key
 *   src       path inside public/ (with the leading slash), or a full URL
 *   position  [x, y, z]   +x = right, +y = up, +z = toward the camera
 *   scale     one number for uniform scaling, or [x, y, z]
 *   rotation  [x, y, z] in DEGREES — a static tilt, written the way you
 *             think about angles (converted to radians for you)
 *   spin      continuous Y rotation in radians per second. 0 = still,
 *             negative = the other way. The cake's gentle turn is 0.4.
 *   center    true (default) auto-centers the geometry on `position`, so the
 *             model spins in place instead of wobbling around an off-centre
 *             origin. Set false to keep the file's own origin.
 *   visible   set false to keep the entry here without rendering it
 *   narrow    optional overrides used on small screens — see RESPONSIVE below
 *
 * ⚠️  THE WORLD IS SMALL — this is the part that trips everyone up.
 * The camera sits at [0, 0.5, 1] with a 45° fov and looks at the origin, so
 * at z = 0 you can only see roughly x: -0.8 … 0.8 and y: -0.45 … 0.45.
 * Nudge positions in steps of 0.1 — a value like 2 or 3 puts the model
 * completely off-screen. Raising z (toward the camera) also makes it look
 * bigger, since it moves closer to the lens.
 *
 * There is no universal scale number: it depends on the units the model was
 * exported in. Start at 1 — a speck? try 5, 10, 50. Fills the screen? try
 * 0.5, 0.1. The cake below needs 7.
 *
 * The same file may be listed more than once (each instance is cloned), so
 * you can scatter one balloon model around the cake at different sizes.
 *
 * ─────────────────────────────────────────────────────────────────────
 *  RESPONSIVE — how the scene adapts to the screen (heroFit below)
 * ─────────────────────────────────────────────────────────────────────
 * The camera's fov is VERTICAL, so the visible world height is ~0.93 units
 * on every device, from a phone to a 4K monitor. It is the visible WIDTH
 * that changes: 0.93 × the canvas aspect ratio. A desktop canvas is wide
 * and short (aspect ~2.5–3) so there is plenty of room either side of the
 * cake; a phone canvas is nearly square (aspect ~1.0) so models sitting at
 * x = ±0.3 fall off the edges.
 *
 * To fix that, everything is wrapped in one "stage" group that is scaled by
 *
 *     clamp(canvas aspect / referenceAspect, minScale, maxScale)
 *
 * Scaling the group shrinks the models AND their positions together, so the
 * whole arrangement stays centred and keeps the same proportions — it simply
 * occupies the same slice of the width on any screen. Because maxScale is 1,
 * a wide desktop is never enlarged: the look you tuned stays exactly as is,
 * and only narrower screens shrink.
 *
 * With the defaults below, the measured effect on this scene is:
 *
 *     device              canvas aspect   scene scale   width used
 *     desktop 1440×900         2.14          1.00         37%   (unchanged)
 *     laptop  1280×800         2.20          1.00         36%   (unchanged)
 *     tablet   820×1180        0.86          0.86         79%
 *     phone    390×844         0.57          0.57         79%   (was 137% —
 *     small phone 360×740      0.60          0.60         79%    clipped)
 *
 * Anything above referenceAspect is capped at maxScale, which is why desktops
 * are left completely alone; anything below it shrinks proportionally, so all
 * the narrow screens end up using the same fraction of the width.
 *
 * Tuning it:
 *   referenceAspect  the main dial. Lower it (0.8) to make phones bigger —
 *                    at the risk of clipping again; raise it (1.4) to make
 *                    them smaller and safer. Set heroSceneDebug to true and
 *                    the live canvas aspect + applied scale are printed to the
 *                    console on every resize, so you can read off the exact
 *                    numbers for your own screen.
 *   minScale         floor, so an extremely tall narrow window can't shrink
 *                    the scene to nothing. If models still clip on your phone,
 *                    lower this (0.3) instead of fighting with positions.
 *   maxScale         ceiling. Leave at 1 unless you want ultrawide monitors to
 *                    get a bigger scene than the one you tuned.
 *   narrowAspect     below this aspect, each model's `narrow` overrides (if it
 *                    has any) replace its normal values.
 *   enabled          false = the old behaviour, one fixed size everywhere.
 *
 * `narrow` overrides are the escape hatch for when shrinking is not enough —
 * on a tall phone there is relatively more room above and below than beside
 * the cake, so you can pull models inward or stack them instead:
 *
 *   {
 *     id: "balloon",
 *     position: [0.3, 0, 0],
 *     scale: 0.4,
 *     narrow: { position: [0.18, 0.08, 0.05], scale: 0.32 },
 *   }
 *
 * Any field can be overridden — position, scale, rotation, spin, center,
 * even visible: false to drop a model on small screens entirely.
 *
 * 💡 Set heroSceneDebug to true to draw a grid and an axis gizmo in the scene
 * (red = x, green = y, blue = z) and log the live fit numbers. The grid is
 * drawn in unscaled world units, so you can see the real extents.
 * Turn it back off before sharing the page.
 */

export const heroSceneDebug = false;

export const heroFit = {
  enabled: true,
  // A square canvas. Above this aspect the scale is capped at maxScale, so
  // desktops keep exactly the look you tuned; below it the scene shrinks in
  // proportion, holding the same fraction of the width on every narrow screen.
  referenceAspect: 1.0,
  minScale: 0.4,
  maxScale: 1,
  narrowAspect: 1.0,
};

export const heroModels = [
  {
    id: "strawberry-cake",
    src: "/strawberry_cake.glb",
    position: [0, 0, 0],
    scale: 7,
    rotation: [0, 0, 0],
    spin: 0.4,
  },
  // {
  //   id: "balloon-dog",
  //   src: "/balloon_dog.glb",
  //   position: [0.4, 0, 0],
  //   scale: 3,
  //   rotation: [0, 0, 0],
  //   spin: 0,
  // },
  {
    id: "balloon",
    src: "/balloon.glb",
    position: [0.3, 0, 0],
    scale: 0.4,
    rotation: [0, 0, 0],
    spin: 0,
    // narrow: { position: [0.2, 0.05, 0.05], scale: 0.34 },
  },
  {
    id: "gift-box",
    src: "/gift_box.glb",
    position: [-0.2, 0, 0.36],
    scale: 0.07,
    rotation: [0, 0, 0],
    spin: 0,
    // narrow: { position: [-0.16, 0, 0.32] },
  },
];

export default heroModels;