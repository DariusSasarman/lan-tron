
import * as THREE from "three";

/* =========================================================
   CONFIGURATION
========================================================= */

const CONFIG = {
    trackRadius: 1500,
    trackWidth: 14,
    wallHeight: 0.8,

    // Number of spline samples per original control-point segment.
    trackSubdivisions: 8,

    maxSpeed: 90,
    reverseSpeed: 18,

    acceleration: 15,
    braking: 40,
    drag: 11,

    steering: 2.2,
    minSteerFactor: 0.6,   // fraction of steering left at max speed
    kartRadius: 1.5,

    wallSpinSpeed: 14,
    wallSpinDamping: 2.0,

    wallBounceSpeed: 16,
    wallBounceDuration: 0.32,

    shellSpeed: 70,
    shellCooldown: 700,
    shellMaxBounces: 5,

    laps: 3,

    boostAmount: 10,
    mushroomCount: 8,

    // Smaller blocks give the original pixel pass twice the resolution.
    pixelSize: 3,
    colorLevels: 32,

    centerLineLength: 5,
    centerLineWidth: 0.22,

    fogNear: 140,
    fogFar: 1400,
    buildingRenderDistance: 1600
};

const KART_COLORS = [
    0xef4444,
    0x2563eb,
    0x22c55e,
    0xf59e0b,
    0xa855f7,
    0x06b6d4
];

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

const carStats = {
    acceleration: randomBetween(12, 18),
    maxSpeed: randomBetween(80, 100),
    steering: randomBetween(1.8, 2.6),
    shellCooldown: randomBetween(700, 1200),
    color: KART_COLORS[Math.floor(Math.random() * KART_COLORS.length)]
};

/* =========================================================
   GLOBAL GAME STATE
========================================================= */

let spinLocked = false;
let spinAngle = 0;
let spinVelocity = 0;

const bounceVelocity = new THREE.Vector3();
let bounceTimer = 0;

const knockback = new THREE.Vector3();

let ang = 0;
let vel = 0;
let boostTimer = 0;
let sparkSpawnTimer = 0;

let raceStarted = false;
let finished = false;
let sentFinish = false;

let myId = null;
let connected = false;

/* =========================================================
   THREE.JS INITIALIZATION
========================================================= */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x0a0014);
scene.fog = new THREE.Fog(
    0x0a0014,
    CONFIG.fogNear,
    CONFIG.fogFar
);

const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    CONFIG.fogFar + 200
);

const renderer = new THREE.WebGLRenderer({
    antialias: false
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

const sparkGeometry = new THREE.SphereGeometry(0.08, 4, 4);
const sparkMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb000,
    fog: true
});
const sparks = [];

function spawnWallSparks(position, normal) {
    for (let i = 0; i < 3; i++) {
        const mesh = new THREE.Mesh(sparkGeometry, sparkMaterial);
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5 + normal.x * 4,
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 5 + normal.z * 4
        );

        mesh.position.copy(position)
            .addScaledVector(normal, 0.12)
            .add(new THREE.Vector3(0, 0.35, 0));
        scene.add(mesh);
        sparks.push({ mesh, velocity, life: 0.22 });
    }
}

function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.life -= dt;
        spark.velocity.y -= 12 * dt;
        spark.mesh.position.addScaledVector(spark.velocity, dt);

        if (spark.life <= 0) {
            scene.remove(spark.mesh);
            sparks.splice(i, 1);
        }
    }
}

const pixelRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true
    }
);

const pixelScene = new THREE.Scene();
const pixelCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const pixelMaterial = new THREE.ShaderMaterial({
    uniforms: {
        sceneTexture: { value: pixelRenderTarget.texture },
        resolution: {
            value: new THREE.Vector2(window.innerWidth, window.innerHeight)
        },
        pixelSize: { value: CONFIG.pixelSize },
        colorLevels: { value: CONFIG.colorLevels }
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D sceneTexture;
        uniform vec2 resolution;
        uniform float pixelSize;
        uniform float colorLevels;
        varying vec2 vUv;

        void main() {
            vec2 pixelCoord = floor(vUv * resolution / pixelSize);
            vec2 pixelatedUv = (pixelCoord + 0.5)
                * pixelSize / resolution;
            vec3 color = texture2D(sceneTexture, pixelatedUv).rgb;

            float ditherX = mod(pixelCoord.x, 2.0);
            float ditherY = mod(pixelCoord.y, 2.0);
            float dither = ditherX > 0.5
                ? (ditherY > 0.5 ? 0.25 : 0.5)
                : (ditherY > 0.5 ? 0.75 : 0.0);
            dither = (dither - 0.5) / colorLevels;

            color = floor((color + dither) * colorLevels + 0.5)
                / colorLevels;
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    depthTest: false,
    depthWrite: false
});

pixelScene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    pixelMaterial
));

scene.add(new THREE.HemisphereLight(0xffffff, 0x526044, 1.3));

const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(80, 120, 40);
sun.castShadow = true;

sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -2000;
sun.shadow.camera.right = 2000;
sun.shadow.camera.top = 2000;
sun.shadow.camera.bottom = -2000;

scene.add(sun);

/* =========================================================
   MATERIALS
========================================================= */

const materials = {
    grass: new THREE.MeshStandardMaterial({
        color: 0x347b42,
        roughness: 1,
        fog: true
    }),

    asphalt: new THREE.MeshStandardMaterial({
        color: 0x30343b,
        roughness: 0.95,
        side: THREE.DoubleSide,
        fog: true
    }),

    wall: new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        roughness: 0.5,
        fog: true
    }),

    line: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        fog: true
    }),

    red: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.6,
        roughness: 0.65,
        fog: true
    }),

    blue: new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        emissive: 0x2563eb,
        emissiveIntensity: 0.6,
        roughness: 0.65,
        fog: true
    }),

    black: new THREE.MeshStandardMaterial({
        color: 0x111827,
        fog: true
    }),

    glass: new THREE.MeshStandardMaterial({
        color: 0x172554,
        metalness: 0.3,
        roughness: 0.3,
        fog: true
    }),

    shell: new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x064e3b,
        emissiveIntensity: 1,
        fog: true
    })
};

/* =========================================================
   WORLD
========================================================= */

// const ground = new THREE.Mesh(
//     new THREE.PlaneGeometry(8000, 8000),
//     materials.grass
// );
// ground.rotation.x = -Math.PI / 2;
// ground.position.y = -0.12;
// ground.receiveShadow = true;
// scene.add(ground);

const buildingColors = [0xff00ff, 0x00ffff, 0xff0080, 0x8000ff, 0x00ff80];
const buildings = [];

function makeWindowTexture(baseHex) {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#" + baseHex.toString(16).padStart(6, "0");
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#ffffcc";
    for (let y = 8; y < c.height; y += 16) {
        for (let x = 6; x < c.width; x += 14) {
            if (Math.random() > 0.35) ctx.fillRect(x, y, 6, 8);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function rebuildBuildings() {
    for (const m of buildings) scene.remove(m);
    buildings.length = 0;
    for (let i = 0; i < 600; i++) {
        const x = (Math.random() * 2 - 1) * (CONFIG.trackRadius + 120);
        const z = (Math.random() * 2 - 1) * (CONFIG.trackRadius + 120);
        // avoid track surface
        let near = false;
        for (const p of trackPoints) {
            const dx = p.x - x, dz = p.z - z;
            if (dx * dx + dz * dz < (CONFIG.trackWidth / 2 + 30) ** 2) { near = true; break; }
        }
        if (near) continue;
        const w = 18 + Math.random() * 28;
        const d = 18 + Math.random() * 28;
        const h = 1200;
        const base = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const tex = makeWindowTexture(base);
        tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 16)));
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.4,
            emissive: base,
            emissiveIntensity: 0.4,
            fog: true
        });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, h / 2, z);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m); buildings.push(m);
        const m2 = m.clone(); m2.position.y = -h / 2; scene.add(m2); buildings.push(m2);
    }
}

function updateBuildingVisibility() {
    const maxDistanceSquared = CONFIG.buildingRenderDistance ** 2;

    for (const building of buildings) {
        const dx = building.position.x - camera.position.x;
        const dz = building.position.z - camera.position.z;
        building.visible = dx * dx + dz * dz <= maxDistanceSquared;
    }
}

/* =========================================================
   TRACK GENERATION
========================================================= */

let trackPoints = [];
let trackSegments = [];

let spawnPosition = new THREE.Vector3();
let spawnAngle = 0;

let trackObjects = [];

const mushrooms = [];

function removeMushrooms() {
    for (const m of mushrooms) {
        scene.remove(m.mesh);
        if (m.mesh.geometry) m.mesh.geometry.dispose();
    }
    mushrooms.length = 0;
}

function spawnMushrooms() {
    removeMushrooms();
    const mat = new THREE.MeshStandardMaterial({
        color: 0xff66cc,
        emissive: 0x660044,
        fog: true
    });
    for (let i = 0; i < CONFIG.mushroomCount; i++) {
        const seg = trackSegments[Math.floor(Math.random() * trackSegments.length)];
        const t = Math.random();
        const point = seg.a.clone().lerp(seg.b, t);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), mat);
        mesh.position.copy(point);
        mesh.position.y = 0.6;
        scene.add(mesh);
        mushrooms.push({ mesh, point });
    }
}

function removeTrack() {
    for (const object of trackObjects) {
        scene.remove(object);

        if (object.geometry) {
            object.geometry.dispose();
        }
    }

    trackObjects = [];
}

function addTrackObject(object) {
    scene.add(object);
    trackObjects.push(object);
}

/*
    Interpolates the original control points using a closed
    Catmull-Rom spline.
*/
function interpolateTrack(controlPoints) {
    const curve = new THREE.CatmullRomCurve3(
        controlPoints,
        true,           // Closed curve
        "centripetal"   // Reduces unwanted spline overshoot
    );

    const subdivisions = CONFIG.trackSubdivisions;

    const sampleCount = controlPoints.length * subdivisions;

    // getPoints includes the duplicated closing point.
    return curve.getPoints(sampleCount).slice(0, -1);
}

function buildTrack(params) {
    removeTrack();

    // Theme
    const themes = {
        grass: { ground: 0x347b42, sky: 0x87ceeb },
        sand: { ground: 0xc2a878, sky: 0xdfe9f3 },
        leaves: { ground: 0x8b5a2b, sky: 0xbfd6e8 },
        snow: { ground: 0xe8eef2, sky: 0xcfe6f5 },
        dirt: { ground: 0x5c4033, sky: 0xa9b8c9 },
    };
    const theme = themes[params.theme] || themes.grass;
    materials.grass.color.setHex(theme.ground);
    scene.background = new THREE.Color(0x0a0014);
    scene.fog = new THREE.Fog(
        0x0a0014,
        CONFIG.fogNear,
        CONFIG.fogFar
    );

    trackPoints = [];
    trackSegments = [];

    const controlPointCount = 512;
    const radius = CONFIG.trackRadius;

    /* 1. Generate original control points */

    const controlPoints = [];

    for (let i = 0; i < controlPointCount; i++) {
        const a = (i / controlPointCount) * Math.PI * 2;

        const r =
            radius +
            params.h1_a * 20 * Math.sin(2 * a + params.h1_p) +
            params.h2_a * 20 * Math.cos(3 * a + params.h2_p) +
            params.h3_a * 20 * Math.sin(4 * a + params.h3_p) +
            (params.h4_a || 0) * 20 *
            Math.cos(5 * a + (params.h4_p || 0)) +
            (params.h5_a || 0) * 20 *
            Math.sin(6 * a + (params.h5_p || 0));

        controlPoints.push(
            new THREE.Vector3(
                Math.cos(a) * r,
                0,
                Math.sin(a) * r
            )
        );
    }

    /* 2. Interpolate the track */

    trackPoints = interpolateTrack(controlPoints);

    const count = trackPoints.length;

    /* 3. Continuous tangents and normals (one per point) */

    const pointNormals = [];
    const pointTangents = [];

    for (let i = 0; i < count; i++) {
        const previous = trackPoints[(i - 1 + count) % count];
        const next = trackPoints[(i + 1) % count];

        const tangent = new THREE.Vector3()
            .subVectors(next, previous)
            .normalize();

        const normal = new THREE.Vector3(
            -tangent.z,
            0,
            tangent.x
        );

        pointTangents.push(tangent);
        pointNormals.push(normal);
    }

    /* 4. Track segments */

    for (let i = 0; i < count; i++) {
        const nextIndex = (i + 1) % count;

        trackSegments.push({
            index: i,
            a: trackPoints[i],
            b: trackPoints[nextIndex],
            tangent: pointTangents[i],
            normal: pointNormals[i]
        });
    }

    /* 5. Road and wall geometry */

    const roadVertices = [];
    const roadIndices = [];

    const wallVertices = [];
    const wallIndices = [];

    const markingVertices = [];
    const markingIndices = [];

    const halfWidth = CONFIG.trackWidth / 2;

    for (let i = 0; i < count; i++) {
        const nextIndex = (i + 1) % count;

        const a = trackPoints[i];
        const b = trackPoints[nextIndex];

        const normalA = pointNormals[i];
        const normalB = pointNormals[nextIndex];

        const leftA = a.clone().addScaledVector(normalA, halfWidth);
        const rightA = a.clone().addScaledVector(normalA, -halfWidth);
        const leftB = b.clone().addScaledVector(normalB, halfWidth);
        const rightB = b.clone().addScaledVector(normalB, -halfWidth);

        /* Road */

        const base = roadVertices.length / 3;

        roadVertices.push(
            leftA.x, 0.02, leftA.z,
            rightA.x, 0.02, rightA.z,
            leftB.x, 0.02, leftB.z,
            rightB.x, 0.02, rightB.z
        );

        roadIndices.push(
            base, base + 2, base + 1,
            base + 1, base + 2, base + 3
        );

        /* Walls */

        const wallBase = wallVertices.length / 3;

        wallVertices.push(
            leftA.x, 0.02, leftA.z,
            leftB.x, 0.02, leftB.z,
            leftA.x, CONFIG.wallHeight, leftA.z,
            leftB.x, CONFIG.wallHeight, leftB.z,

            rightA.x, 0.02, rightA.z,
            rightB.x, 0.02, rightB.z,
            rightA.x, CONFIG.wallHeight, rightA.z,
            rightB.x, CONFIG.wallHeight, rightB.z
        );

        wallIndices.push(
            wallBase, wallBase + 1, wallBase + 2,
            wallBase + 1, wallBase + 3, wallBase + 2,

            wallBase + 4, wallBase + 6, wallBase + 5,
            wallBase + 5, wallBase + 6, wallBase + 7
        );

        /* Center-line markings */

        if (i % 8 === 0) {
            const mid = a.clone().lerp(b, 0.5);
            const tangent = pointTangents[i];
            const halfLength = CONFIG.centerLineLength / 2;
            const halfWidth = CONFIG.centerLineWidth / 2;

            const p1 = mid.clone().addScaledVector(tangent, -halfLength);
            const p2 = mid.clone().addScaledVector(tangent, halfLength);
            const p1Left = p1.clone().addScaledVector(pointNormals[i], halfWidth);
            const p1Right = p1.clone().addScaledVector(pointNormals[i], -halfWidth);
            const p2Left = p2.clone().addScaledVector(pointNormals[i], halfWidth);
            const p2Right = p2.clone().addScaledVector(pointNormals[i], -halfWidth);
            const base = markingVertices.length / 3;

            markingVertices.push(
                p1Left.x, 0.04, p1Left.z,
                p1Right.x, 0.04, p1Right.z,
                p2Left.x, 0.04, p2Left.z,
                p2Right.x, 0.04, p2Right.z
            );
            markingIndices.push(
                base, base + 2, base + 1,
                base + 1, base + 2, base + 3
            );
        }
    }

    /* 6. Road mesh */

    const roadGeometry = new THREE.BufferGeometry();

    roadGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(roadVertices, 3)
    );

    roadGeometry.setIndex(roadIndices);
    roadGeometry.computeVertexNormals();

    const road = new THREE.Mesh(roadGeometry, materials.asphalt);
    road.receiveShadow = true;

    addTrackObject(road);

    /* 7. Wall mesh */

    const wallGeometry = new THREE.BufferGeometry();

    wallGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(wallVertices, 3)
    );

    wallGeometry.setIndex(wallIndices);
    wallGeometry.computeVertexNormals();

    const walls = new THREE.Mesh(
        wallGeometry,
        new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            side: THREE.DoubleSide,
            fog: true
        })
    );

    walls.castShadow = true;
    walls.receiveShadow = true;

    addTrackObject(walls);

    /* 8. Road markings */

    const lineGeometry = new THREE.BufferGeometry();

    lineGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(markingVertices, 3)
    );

    lineGeometry.setIndex(markingIndices);
    lineGeometry.computeVertexNormals();

    const lines = new THREE.Mesh(
    lineGeometry,
    materials.line
);

    addTrackObject(lines);

    /* 9. Start line and spawn */

    const first = trackPoints[0];
    const direction = pointTangents[0];

    spawnAngle = Math.atan2(direction.x, direction.z);

    spawnPosition.copy(first).addScaledVector(direction, -6);
    spawnPosition.y = 0;

    const startLine = new THREE.Mesh(
        new THREE.BoxGeometry(CONFIG.trackWidth, 0.035, 1.2),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x333333,
            fog: true
        })
    );

    startLine.position.copy(first);
    startLine.position.y = 0.05;
    startLine.rotation.y = spawnAngle;

    addTrackObject(startLine);

    /* 10. Checkered finish line */

    const squareSize = 0.8;
    const tileCount = Math.floor(CONFIG.trackWidth / squareSize);

    const squareGeometry = new THREE.BoxGeometry(
        squareSize,
        0.04,
        squareSize
    );

    const blackMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        fog: true
    });
    const whiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        fog: true
    });

    const lateral = new THREE.Vector3(
        Math.cos(spawnAngle),
        0,
        -Math.sin(spawnAngle)
    );

    for (let i = 0; i < tileCount; i++) {
        const tile = new THREE.Mesh(
            squareGeometry,
            (i % 2 === 0) ? blackMaterial : whiteMaterial
        );

        const offset = (i - (tileCount - 1) / 2) * squareSize;

        tile.position.copy(first).addScaledVector(lateral, offset);
        tile.position.y = 0.08;

        addTrackObject(tile);
    }

    spawnMushrooms();
    rebuildBuildings();
}

buildTrack({
    h1_a: 8, h1_p: 0,
    h2_a: 4, h2_p: 0,
    h3_a: 2, h3_p: 0,
    h4_a: 3, h4_p: 0
});

/* =========================================================
   TRON MOTORCYCLE MODEL
========================================================= */

function makeKart(color) {
    const root = new THREE.Group();

    const visual = new THREE.Group();
    root.add(visual);

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.55,
        fog: true
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.8,
        roughness: 0.35,
        fog: true
    });

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.05, 0.42, 1.8),
        bodyMaterial
    );
    body.position.set(0, 0.58, -0.05);
    body.castShadow = true;
    visual.add(body);

    const tank = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 8, 5),
        bodyMaterial
    );
    tank.scale.set(0.88, 0.48, 1.15);
    tank.position.set(0, 0.92, 0.35);
    tank.castShadow = true;
    visual.add(tank);

    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.16, 0.92),
        materials.black
    );
    seat.position.set(0, 0.93, -0.62);
    visual.add(seat);

    const spine = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.13, 2.8),
        accentMaterial
    );
    spine.position.set(0, 0.38, 0);
    visual.add(spine);

    const fork = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.92, 6),
        accentMaterial
    );
    fork.position.set(0, 0.7, 1.12);
    fork.rotation.x = -0.22;
    visual.add(fork);

    const handlebar = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.08, 0.08),
        accentMaterial
    );
    handlebar.position.set(0, 1.08, 1.02);
    visual.add(handlebar);

    const headlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 6, 4),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: color,
            emissiveIntensity: 2.5,
            fog: true
        })
    );
    headlight.position.set(0, 0.92, 1.28);
    visual.add(headlight);

    const wheelGeometry = new THREE.CylinderGeometry(0.48, 0.48, 0.66, 8);

    for (const z of [-1.12, 1.12]) {
        const wheel = new THREE.Mesh(wheelGeometry, materials.black);

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.48, z);
        wheel.castShadow = true;
        visual.add(wheel);
    }

    const trailGeometry = new THREE.PlaneGeometry(0.9, 1.2);
    const trailMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: true
    });
    const trail = new THREE.Group();
    const trailGlow = new THREE.Group();
    const trailGlowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: true
    });

    scene.add(root);
    scene.add(trail, trailGlow);

    return {
        root,
        visual,
        bodyMaterial,
        color,
        trail,
        trailGlow,
        trailGeometry,
        trailMaterial,
        trailGlowMaterial,
        trailPoints: [],
        trailPanelCount: 0,
        trailLifetime: 0.5
    };
}

function resetKartTrail(kart) {
    kart.trailPoints = [];
    kart.trail.clear();
    kart.trailGlow.clear();
    kart.trailPanelCount = 0;
}

function rebuildKartTrail(kart) {
    kart.trail.clear();
    kart.trailGlow.clear();

    kart.trailPoints.forEach(trailPoint => {
        const panel = new THREE.Mesh(
            kart.trailGeometry,
            kart.trailMaterial
        );
        panel.position.set(
            trailPoint.position.x,
            0.6,
            trailPoint.position.z
        );
        panel.rotation.y = trailPoint.angle;
        kart.trail.add(panel);

        const glowPanel = new THREE.Mesh(
            kart.trailGeometry,
            kart.trailGlowMaterial
        );
        glowPanel.position.copy(panel.position);
        glowPanel.rotation.y = trailPoint.angle;
        glowPanel.scale.set(1.7, 1.1, 1);
        kart.trailGlow.add(glowPanel);
    });

    kart.trailPanelCount = kart.trailPoints.length;
}

function updateKartTrail(kart, dt) {
    kart.trailPoints.forEach(trailPoint => {
        trailPoint.age += dt;
    });

    const activePoints = kart.trailPoints.filter(
        trailPoint => trailPoint.age < kart.trailLifetime
    );
    const expired = activePoints.length !== kart.trailPoints.length;
    kart.trailPoints = activePoints;

    const point = kart.root.position.clone();
    point.y = 0;

    const lastPoint = kart.trailPoints[kart.trailPoints.length - 1];
    if (!lastPoint || point.distanceToSquared(lastPoint.position) > 0.01) {
        const previous = lastPoint?.position ?? point;
        const tangent = point.clone().sub(previous).setY(0);
        const angle = tangent.lengthSq() > 0.0001
            ? Math.atan2(tangent.x, tangent.z)
            : kart.root.rotation.y;

        kart.trailPoints.push({ position: point, angle, age: 0 });
        if (kart.trailPoints.length > 32) kart.trailPoints.shift();
        rebuildKartTrail(kart);
    } else if (expired) {
        rebuildKartTrail(kart);
    }

}

const player = makeKart(carStats.color);

const remoteKarts = new Map();
const playerNames = new Map();
const playerWins = new Map();

function positionPlayerAtSpawn() {
    player.root.position.copy(spawnPosition);
    player.root.rotation.y = spawnAngle;

    ang = spawnAngle;
    vel = 0;

    spinLocked = false;
    spinAngle = 0;
    spinVelocity = 0;

    bounceVelocity.set(0, 0, 0);
    bounceTimer = 0;

    knockback.set(0, 0, 0);

    player.visual.rotation.y = 0;
    resetKartTrail(player);
}

positionPlayerAtSpawn();

/* =========================================================
   INPUT
========================================================= */

const keys = {};

window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if ([
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " "
    ].includes(key)) {
        event.preventDefault();
    }

    if (!keys[key] && key === " ") {
        shootShell();
    }

    if (key === "r" && !event.repeat) {
        resetRace();
    }

    keys[key] = true;
});

window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});

/* =========================================================
   NETWORK
========================================================= */

const protocol = location.protocol === "https:" ? "wss:" : "ws:";

const ws = new WebSocket(
    protocol + "//" + location.host + "/ws"
);

const connectionEl = document.getElementById("connection");

function send(message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

ws.onopen = () => {
    connected = true;
    connectionEl.textContent = "Connected";
    connectionEl.style.color = "#4ade80";
};

ws.onclose = () => {
    connected = false;
    connectionEl.textContent = "Disconnected";
    connectionEl.style.color = "#f87171";
};

ws.onerror = () => {
    connectionEl.textContent = "Connection error";
    connectionEl.style.color = "#f87171";
};

ws.onmessage = event => {
    let message;

    try {
        message = JSON.parse(event.data);
    } catch {
        return;
    }

    if (message.type === "welcome") {
        myId = message.id;

        document.getElementById("pid").textContent = myId;

        if (message.names) {
            for (const [id, name] of Object.entries(message.names)) {
                playerNames.set(id, name);
            }
        }

        if (message.wins) {
            for (const [id, count] of Object.entries(message.wins)) {
                playerWins.set(id, count);
            }
        }

        renderScoreboard();
        buildTrack(message.track);
        resetRace();
    }

    if (message.type === "name") {
        playerNames.set(message.id, message.name);
        renderScoreboard();
    }

    if (message.type === "state") {
        if (message.id === myId) return;

        let remote = remoteKarts.get(message.id);

        if (!remote) {
            remote = makeKart(message.color ?? 0x2563eb);
            remoteKarts.set(message.id, remote);
        }

        if (Number.isInteger(message.color) && remote.color !== message.color) {
            remote.bodyMaterial.color.setHex(message.color);
            remote.bodyMaterial.emissive.setHex(message.color);
            remote.trailMaterial.color.setHex(message.color);
            remote.trailGlowMaterial.color.setHex(message.color);
            remote.color = message.color;
        }

        remote.targetPosition = new THREE.Vector3(
            message.x,
            0,
            message.z
        );

        if (!remote.hasReceivedState) {
            remote.root.position.copy(remote.targetPosition);
            remote.hasReceivedState = true;
            resetKartTrail(remote);
        }

        remote.targetAngle = message.ang;
        remote.speed = message.speed || 0;
        remote.spin = message.spin || 0;

        updatePlayerCount();
    }

    if (message.type === "leave") {
        const remote = remoteKarts.get(message.id);

        if (remote) {
            scene.remove(remote.root);
            scene.remove(remote.trail, remote.trailGlow);
            remoteKarts.delete(message.id);
        }

        updatePlayerCount();
    }

    if (message.type === "shoot") {
        createShell(message);
    }

    if (message.type === "projectile_hit") {
        if (message.target === myId) {
            const dir = new THREE.Vector3(message.dx, 0, message.dz);
            if (dir.lengthSq() > 0.001) dir.normalize();

            // startWallSpin pushes along -normal, so pass the negated direction
            startWallSpin(dir.negate());
        }

        removeShell(message.projectile_id);
    }

    if (message.type === "winner") {
        const winner = document.getElementById("winner");

        winner.style.display = "flex";
        winner.textContent =
            message.id === myId
                ? "YOU WIN!"
                : "PLAYER " + message.id + " WINS!";

        if (message.wins !== undefined) {
            playerWins.set(message.id, message.wins);
            renderScoreboard();
        }
    }

    if (message.type === "reset") {
        document.getElementById("winner").style.display = "none";

        buildTrack(message.track);
        resetRace();
    }
};

function renderScoreboard() {
    const el = document.getElementById("scoreboard");
    const ids = [myId, ...remoteKarts.keys()];
    el.replaceChildren();

    const title = document.createElement("b");
    title.textContent = "PLAYERS";
    el.append(title);

    for (const id of ids) {
        const name = playerNames.get(id) || id;
        const w = playerWins.get(id) || 0;
        const row = document.createElement("div");
        row.className = id === myId ? "player-row local" : "player-row";

        const nameEl = document.createElement("span");
        nameEl.textContent = id === myId ? "> " + name : name;

        const winsEl = document.createElement("span");
        winsEl.className = "player-wins";
        winsEl.textContent = String(w).padStart(2, "0");

        row.append(nameEl, winsEl);
        el.append(row);
    }
}

function drawMinimap() {
    const canvas = document.getElementById("minimap");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!trackPoints.length) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of trackPoints) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const scale = Math.min(canvas.width, canvas.height) / Math.max(maxX - minX, maxZ - minZ) * 0.9;
    const cx = canvas.width / 2;
    const cz = canvas.height / 2;
    const ox = (minX + maxX) / 2;
    const oz = (minZ + maxZ) / 2;

    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const x = cx + (p.x - ox) * scale;
        const y = cz + (p.z - oz) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // player dot + direction arrow
    const px = cx + (player.root.position.x - ox) * scale;
    const py = cz + (player.root.position.z - oz) * scale;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // remote players
    ctx.fillStyle = "#3b82f6";
    for (const r of remoteKarts.values()) {
        const rx = cx + (r.root.position.x - ox) * scale;
        const ry = cz + (r.root.position.z - oz) * scale;
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    const ax = px + Math.sin(ang) * 10;
    const ay = py + Math.cos(ang) * 10;
    ctx.strokeStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ax, ay);
    ctx.stroke();
}

function updatePlayerCount() {
    document.getElementById("players").textContent = remoteKarts.size + 1;
    renderScoreboard();
}
/* =========================================================
   PROJECTILES
========================================================= */

const shells = new Map();

const shellGeometry = new THREE.SphereGeometry(0.38, 12, 12);

let lastShotAt = 0;

function shootShell() {
    const now = performance.now();

    if (
        now - lastShotAt < carStats.shellCooldown ||
        !raceStarted ||
        finished ||
        !connected ||
        spinLocked
    ) {
        return;
    }

    lastShotAt = now;

    send({
        type: "shoot",
        x: player.root.position.x,
        z: player.root.position.z,
        ang,
        speed: vel
    });
}

function createShell(message) {
    if (shells.has(message.projectile_id)) return;

    const mesh = new THREE.Mesh(shellGeometry, materials.shell);

    const forward = new THREE.Vector3(
        Math.sin(message.ang),
        0,
        Math.cos(message.ang)
    );

    const shellSpeed = CONFIG.shellSpeed + (message.speed || 0);

    mesh.position.set(
        message.x + forward.x * 2,
        0.75,
        message.z + forward.z * 2
    );

    scene.add(mesh);

    shells.set(message.projectile_id, {
        mesh,
        owner: message.owner,
        velocity: forward.multiplyScalar(shellSpeed),
        age: 0,
        bounces: 0,
        reportedHit: false
    });
}

function removeShell(id) {
    const shell = shells.get(id);

    if (!shell) return;

    scene.remove(shell.mesh);
    shells.delete(id);
}

function updateShells(dt) {
    for (const [id, shell] of shells) {
        shell.age += dt;

        shell.mesh.position.addScaledVector(shell.velocity, dt);

        /* Wall bounce */

        const wallHit = closestTrackPoint(shell.mesh.position);
        const limit = CONFIG.trackWidth / 2 - 0.38;

        if (wallHit.distance > limit) {
            const n = shell.mesh.position.clone().sub(wallHit.point);
            n.y = 0;
            n.normalize();

            const into = shell.velocity.dot(n);
            if (into > 0) shell.velocity.addScaledVector(n, -2 * into);

            shell.mesh.position.copy(wallHit.point)
                .addScaledVector(n, limit - 0.05);
            shell.mesh.position.y = 0.75;

            if (++shell.bounces > CONFIG.shellMaxBounces) {
                removeShell(id);
                continue;
            }
        }

        if (
            shell.age > 4.0 ||
            Math.abs(shell.mesh.position.x) > 3000 ||
            Math.abs(shell.mesh.position.z) > 3000
        ) {
            removeShell(id);
            continue;
        }

        if (shell.owner === myId && !shell.reportedHit) {
            for (const [targetId, remote] of remoteKarts) {
                const distance = Math.hypot(
                    remote.root.position.x - shell.mesh.position.x,
                    remote.root.position.z - shell.mesh.position.z
                );

                if (distance < 2.1) {
                    shell.reportedHit = true;

                    const direction = shell.velocity.clone().normalize();

                    send({
                        type: "projectile_hit",
                        projectile_id: id,
                        target: targetId,
                        dx: direction.x,
                        dz: direction.z
                    });

                    break;
                }
            }
        }
    }
}

/* =========================================================
   TRACK COLLISION
========================================================= */

function closestTrackPoint(position) {
    let bestDistanceSq = Infinity;
    let bestPoint = null;
    let bestSegment = null;

    for (const segment of trackSegments) {
        const ab = new THREE.Vector3().subVectors(segment.b, segment.a);
        const ap = new THREE.Vector3().subVectors(position, segment.a);

        const t = THREE.MathUtils.clamp(
            ap.dot(ab) / ab.lengthSq(),
            0,
            1
        );

        const point = segment.a.clone().addScaledVector(ab, t);

        const distanceSq = position.distanceToSquared(point);

        if (distanceSq < bestDistanceSq) {
            bestDistanceSq = distanceSq;
            bestPoint = point;
            bestSegment = segment;
        }
    }

    return {
        point: bestPoint,
        segment: bestSegment,
        distance: Math.sqrt(bestDistanceSq)
    };
}

/* =========================================================
   WALL SPIN AND REBOUND
========================================================= */

function startWallSpin(normal) {
    if (spinLocked) return;

    spinLocked = true;

    vel = 0;

    spinAngle = 0;
    spinVelocity = CONFIG.wallSpinSpeed;

    bounceVelocity.copy(normal).multiplyScalar(-CONFIG.wallBounceSpeed);

    bounceTimer = CONFIG.wallBounceDuration;

    knockback.set(0, 0, 0);
}

function updateSpin(dt) {
    if (bounceTimer > 0) {
        const step = Math.min(dt, bounceTimer);

        player.root.position.addScaledVector(bounceVelocity, step);

        bounceVelocity.multiplyScalar(Math.exp(-7 * step));

        bounceTimer -= step;

        if (bounceTimer <= 0) {
            bounceVelocity.set(0, 0, 0);
        }
    }

    spinAngle += spinVelocity * dt;

    spinVelocity *= Math.exp(-CONFIG.wallSpinDamping * dt);

    player.visual.rotation.y = spinAngle;

    if (Math.abs(spinVelocity) < 0.2) {
        spinVelocity = 0;
        spinAngle = 0;

        player.visual.rotation.y = 0;

        spinLocked = false;
        vel = 0;

        ang += spinAngle;
        player.root.rotation.y = ang;

        bounceVelocity.set(0, 0, 0);
        bounceTimer = 0;
        knockback.set(0, 0, 0);
    }
}

/* =========================================================
   PLAYER COLLISIONS
========================================================= */

const playerCollisionCooldowns = new Map();

function handlePlayerCollision(nextPosition) {
    player.root.position.copy(nextPosition);

    for (const [id, remote] of remoteKarts) {
        const other = remote.root.position;

        const dx = player.root.position.x - other.x;
        const dz = player.root.position.z - other.z;

        const distance = Math.hypot(dx, dz);
        const minDistance = CONFIG.kartRadius * 2;

        if (distance >= minDistance) {
            continue;
        }

        // Direction pointing away from the other kart.
        let nx, nz;

        if (distance > 0.001) {
            nx = dx / distance;
            nz = dz / distance;
        } else {
            nx = Math.sin(ang);
            nz = Math.cos(ang);
        }

        // Resolve overlap without reflecting driving velocity.
        const overlap = minDistance - distance;

        player.root.position.x += nx * (overlap + 0.02);
        player.root.position.z += nz * (overlap + 0.02);

        // Apply knockback only once per collision.
        const cooldown = playerCollisionCooldowns.get(id) || 0;

        if (cooldown <= 0) {
            const impulse = 14;

            knockback.x += nx * impulse;
            knockback.z += nz * impulse;

            vel *= 0.75;

            playerCollisionCooldowns.set(id, 0.25);
        }
    }
}

/* =========================================================
   LAP SYSTEM
========================================================= */

let lap = 1;
let lapTime = 0;
let bestLap = null;

let progress = 0;   // unwrapped track index (negative before the line)
let lastIndex = 0;
let lapsDone = 0;

function nearestIndex() {
    return closestTrackPoint(player.root.position).segment.index;
}

function initProgress() {
    const n = trackSegments.length;

    lastIndex = nearestIndex();

    // spawn is slightly behind the line, so start just below 0
    progress = lastIndex > n / 2 ? lastIndex - n : lastIndex;
    lapsDone = 0;
}

function updateLaps(dt) {
    if (finished) return;

    const n = trackSegments.length;
    const idx = nearestIndex();

    let delta = idx - lastIndex;
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;

    progress += delta;
    lastIndex = idx;

    const completed = Math.floor(progress / n);

    if (completed > lapsDone) {
        lapsDone = completed;

        if (bestLap === null || lapTime < bestLap) bestLap = lapTime;
        lapTime = 0;

        if (lapsDone >= CONFIG.laps) {
            finished = true;

            if (!sentFinish) {
                sentFinish = true;
                send({ type: "finish" });
            }
        }
    }

    lap = Math.min(lapsDone + 1, CONFIG.laps);
    lapTime += dt;
}

/* =========================================================
   DRIVING PHYSICS
========================================================= */

function updateDriving(dt) {
    if (finished || !raceStarted) return;

    for (const [id, t] of playerCollisionCooldowns) {
        playerCollisionCooldowns.set(id, Math.max(0, t - dt));
    }

    if (spinLocked) {
        updateSpin(dt);
        updateLaps(dt);
        updateShells(dt);
        return;
    }

    const accelerate = keys["w"] || keys["arrowup"];
    const reverse = keys["s"] || keys["arrowdown"];
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];

    if (accelerate) {
        vel += carStats.acceleration * dt;
    }

    if (reverse) {
        if (vel > 0) {
            vel -= CONFIG.braking * dt;
        } else {
            vel -= carStats.acceleration * 0.65 * dt;
        }
    }

    if (!accelerate && !reverse) {
        if (vel > 0) {
            vel = Math.max(0, vel - CONFIG.drag * dt);
        } else if (vel < 0) {
            vel = Math.min(0, vel + CONFIG.drag * dt);
        }
    }

    if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt);

    const speedCap = boostTimer > 0 ? carStats.maxSpeed + 15 : carStats.maxSpeed;

    vel = THREE.MathUtils.clamp(
        vel,
        -CONFIG.reverseSpeed,
        speedCap
    );

    /* Steering: harder at higher speed */

    const speedFactor = Math.min(1, Math.abs(vel) / 8);
    const steeringDirection = vel >= 0 ? 1 : -1;

    const speedRatio = Math.abs(vel) / carStats.maxSpeed;
    const grip = 1 - (1 - CONFIG.minSteerFactor) * speedRatio;
    const steerRate = carStats.steering * speedFactor * grip;

    if (left)  ang += steerRate * dt * steeringDirection;
    if (right) ang -= steerRate * dt * steeringDirection;

    const forward = new THREE.Vector3(
        Math.sin(ang),
        0,
        Math.cos(ang)
    );

    const nextPosition = player.root.position.clone()
        .addScaledVector(forward, vel * dt);

    const closest = closestTrackPoint(nextPosition);

    const safeDistance = CONFIG.trackWidth / 2 - CONFIG.kartRadius;

    if (closest.distance > safeDistance) {
        const normal = nextPosition.clone()
            .sub(closest.point)
            .normalize();
        const wallContact = closest.point.clone()
            .addScaledVector(normal, CONFIG.trackWidth / 2 - 1.0);

        player.root.position.copy(
            closest.point.clone().addScaledVector(
                normal,
                safeDistance - 0.2
            )
        );

        vel = Math.max(0, vel - 2 * carStats.acceleration * dt);

        if (Math.abs(vel) > 4) {
            sparkSpawnTimer -= dt;
            if (sparkSpawnTimer <= 0) {
                spawnWallSparks(wallContact, normal);
                sparkSpawnTimer = 0.045;
            }
        } else {
            sparkSpawnTimer = 0;
        }
    } else {
        sparkSpawnTimer = 0;
        handlePlayerCollision(nextPosition);
    }

    if (knockback.lengthSq() > 0.01) {
        player.root.position.addScaledVector(knockback, dt);

        knockback.multiplyScalar(Math.exp(-5 * dt));
    }

    // Speed boost mushrooms
    for (let i = mushrooms.length - 1; i >= 0; i--) {
        const m = mushrooms[i];
        const d = player.root.position.distanceTo(m.mesh.position);
        if (d < 2.0) {
            boostTimer = 3.0;
            vel = Math.min(carStats.maxSpeed + 15, vel + CONFIG.boostAmount);
            scene.remove(m.mesh);
            if (m.mesh.geometry) m.mesh.geometry.dispose();
            mushrooms.splice(i, 1);
        }
    }

    player.root.position.y = 0;
    player.root.rotation.y = ang;

    player.visual.rotation.y = 0;
    updateKartTrail(player, dt);

    updateLaps(dt);
    updateShells(dt);
}

/* =========================================================
   RESET
========================================================= */

function resetRace() {
    positionPlayerAtSpawn();
    initProgress();
    sparkSpawnTimer = 0;

    lap = 1;
    lapTime = 0;
    bestLap = null;

    finished = false;
    sentFinish = false;

    lastShotAt = 0;
    boostTimer = 0;

    for (const id of [...shells.keys()]) {
        removeShell(id);
    }

    document.getElementById("winner").style.display = "none";

    document.getElementById("lap").textContent = "1";
    document.getElementById("time").textContent = "0.0";
    document.getElementById("best").textContent = "--";
}

/* =========================================================
   CAMERA
========================================================= */

function updateCamera(dt) {
    const forward = new THREE.Vector3(
        Math.sin(ang),
        0,
        Math.cos(ang)
    );

    const desiredPosition = player.root.position.clone()
        .addScaledVector(forward, -9)
        .add(new THREE.Vector3(0, 5.5, 0));

    const blend = 1 - Math.exp(-5 * dt);

    camera.position.lerp(desiredPosition, blend);

    const lookTarget = player.root.position.clone()
        .addScaledVector(forward, 5)
        .add(new THREE.Vector3(0, 1, 0));

    camera.lookAt(lookTarget);
}

/* =========================================================
   REMOTE PLAYER INTERPOLATION
========================================================= */

function updateRemotePlayers(dt) {
    const blend = 1 - Math.exp(-12 * dt);

    for (const remote of remoteKarts.values()) {
        if (!remote.targetPosition) continue;

        remote.root.position.lerp(remote.targetPosition, blend);

        if (remote.targetAngle !== undefined) {
            let difference =
                remote.targetAngle - remote.root.rotation.y;

            while (difference > Math.PI) {
                difference -= Math.PI * 2;
            }

            while (difference < -Math.PI) {
                difference += Math.PI * 2;
            }

            remote.root.rotation.y += difference * blend;
        }

        remote.visual.rotation.y = remote.spin || 0;
        updateKartTrail(remote, dt);
    }
}

/* =========================================================
   NETWORK STATE
========================================================= */

let sendTimer = 0;

function sendPlayerState(dt) {
    sendTimer += dt;

    if (sendTimer < 0.05) return;

    sendTimer = 0;

    send({
        type: "state",
        x: player.root.position.x,
        z: player.root.position.z,
        ang,
        speed: vel,
        spin: spinAngle,
        color: carStats.color
    });
}

/* =========================================================
   HUD
========================================================= */

function updateHUD() {
    document.getElementById("speed").textContent =
        Math.round(Math.abs(vel) * 3.6);

    document.getElementById("lap").textContent =
        Math.min(lap, CONFIG.laps);

    document.getElementById("time").textContent =
        lapTime.toFixed(1);

    document.getElementById("best").textContent =
        bestLap === null ? "--" : bestLap.toFixed(2);
}

/* =========================================================
   GAME LOOP
========================================================= */

document.getElementById("startButton").addEventListener(
    "click",
    () => {
        if (!connected) {
            connectionEl.textContent = "Waiting for server...";
            return;
        }

        raceStarted = true;

        const name = document.getElementById("nameInput").value.trim().slice(0, 20);
        if (name) {
            playerNames.set(myId, name);
            send({ type: "name", name });
            renderScoreboard();
        }

        document.getElementById("overlay").style.display = "none";
    }
);

let lastFrame = performance.now();

function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(
        0.04,
        Math.max(0, (now - lastFrame) / 1000)
    );

    lastFrame = now;

    if (raceStarted) {
        updateDriving(dt);
        updateRemotePlayers(dt);
        sendPlayerState(dt);
        updateCamera(dt);
        updateHUD();
        drawMinimap();
    } else {
        camera.lookAt(0, 0, 0);
    }

    updateSparks(dt);
    updateBuildingVisibility();
    renderer.setRenderTarget(pixelRenderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(pixelScene, pixelCamera);
}

requestAnimationFrame(animate);

/* =========================================================
   RESIZE
========================================================= */

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    pixelRenderTarget.setSize(window.innerWidth, window.innerHeight);
    pixelMaterial.uniforms.resolution.value.set(
        window.innerWidth,
        window.innerHeight
    );
});
