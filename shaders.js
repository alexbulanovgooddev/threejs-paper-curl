export const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;

        gl_Position = projectionMatrix *
                      modelViewMatrix *
                      vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    precision highp float;

    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec2 uImageSize;   // размер картинки, px
    uniform vec2 uPlaneSize;   // размер плоскости, px
    uniform vec2 uPad;         // отступ страницы внутри плоскости, в долях UV (0..0.5)
    uniform float uProgress;   // 0..1

    const float PI = 3.14159265;

    const float minAmount = -0.15;
    const float maxAmount = 1.25;

    const float radius = 0.08;                  // радиус скрутки (в высотах страницы)
    const vec3  paperBack = vec3(0.97, 0.97, 0.96);

    // object-fit: cover
    vec2 coverUv(vec2 uv, vec2 pageSize) {
        float pageAspect = pageSize.x / pageSize.y;
        float imgAspect  = uImageSize.x / uImageSize.y;
        vec2 scale = pageAspect > imgAspect
            ? vec2(1.0, imgAspect / pageAspect)
            : vec2(pageAspect / imgAspect, 1.0);

        return vec2(
            (uv.x - 0.5) * scale.x + 0.5,   // по горизонтали по центру
            1.0 - (1.0 - uv.y) * scale.y    // по вертикали от верхнего края
        );
    }

    bool inPage(vec2 u) {
        return u.x >= 0.0 && u.x <= 1.0 && u.y >= 0.0 && u.y <= 1.0;
    }

    // точка p (в координатах с учётом аспекта), сдвинутая вдоль dir
    // с позиции s на позицию sOrig -> UV страницы
    vec2 unfold(vec2 p, float s, float sOrig, vec2 dir, float aspect) {
        return (p + dir * (sOrig - s)) / vec2(aspect, 1.0);
    }

    void main() {
        vec2 pageSize = uPlaneSize * (1.0 - 2.0 * uPad);
        float aspect = pageSize.x / pageSize.y;

        vec2 uv = (vUv - uPad) / (1.0 - 2.0 * uPad);
        vec2 p  = uv * vec2(aspect, 1.0);

        // скручиваем из правого нижнего угла к левому верхнему
        vec2 corner = vec2(aspect, 0.0);
        vec2 dir    = normalize(vec2(-1.0, 1.0));

        float len  = (aspect + 1.0) * 0.70710678;          // путь до дальнего угла
        float fold = mix(minAmount, maxAmount, uProgress) * len;

        float s = dot(p - corner, dir);   // позиция пикселя вдоль направления скрутки
        float x = fold - s;               // > 0 — пиксель уже в зоне скрутки

        vec4 color = vec4(0.0);
        bool done = false;

        // 1. Отогнутый клапан, лежит сверху (обратная сторона)
        if (x <= 0.0) {
            float sOrig = 2.0 * fold - s - PI * radius;
            vec2 u = unfold(p, s, sOrig, dir, aspect);
            if (inPage(u)) {
                vec3 tex = texture2D(uTexture, coverUv(u, pageSize)).rgb;
                color = vec4(mix(paperBack, tex, 0.08), 1.0);
                done = true;
            }
        }

        // 2. Цилиндр
        if (!done && x >= 0.0 && x <= radius) {
            float t = asin(x / radius);

            // верхняя половина: обратная сторона
            float theta = PI - t;
            vec2 u = unfold(p, s, fold - radius * theta, dir, aspect);
            if (inPage(u)) {
                vec3 tex = texture2D(uTexture, coverUv(u, pageSize)).rgb;
                float shade = mix(0.8, 1.0, -cos(theta));
                color = vec4(mix(paperBack, tex, 0.08) * shade, 1.0);
                done = true;
            } else {
                // нижняя половина: лицевая сторона
                u = unfold(p, s, fold - radius * t, dir, aspect);
                if (inPage(u)) {
                    vec3 tex = texture2D(uTexture, coverUv(u, pageSize)).rgb;
                    float shade = mix(0.85, 1.0, cos(t));
                    color = vec4(tex * shade, 1.0);
                    done = true;
                }
            }
        }

        // 3. Плоская часть страницы + тень от клапана
        if (!done && x <= 0.0 && inPage(uv)) {
            vec3 tex = texture2D(uTexture, coverUv(uv, pageSize)).rgb;

            // куда бы попала эта точка на клапане
            float sFlap = 2.0 * fold - s - PI * radius;
            vec2 uf = unfold(p, s, sFlap, dir, aspect);

            // расстояние от точки до края клапана (0 — прямо у края)
            vec2 outside = max(abs(uf - 0.5) - 0.5, 0.0) * vec2(aspect, 1.0);
            float dist = length(outside);

            float shadow = 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.05, dist));
            color = vec4(tex * shadow, 1.0);
            done = true;
        }

        // 4. Фон: мягкая тень под скруткой
        if (!done && x > 0.0) {
            vec2 u = unfold(p, s, fold, dir, aspect);   // проекция на линию сгиба
            if (inPage(u)) {
                float a = 0.45 * (1.0 - smoothstep(0.0, radius * 1.8, x));
                color = vec4(0.0, 0.0, 0.0, a);
            }
        }

         if (color.a < 0.001) discard;

        gl_FragColor = color;
        #include <colorspace_fragment>
    }
`;
