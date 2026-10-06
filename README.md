# Pay — учебный терминал (зелёная тема, Сбер-стиль)

## Запуск
```
npm install && node server.js
```
Сервер печатает адреса: `http://localhost:3000` и `http://<IP-в-сети>:3000`.

## Структура
- `index.html`, `style.css`, `script.js` (bootstrap: регистрирует экраны, запускает роутер)
- `server.js` — статика (с Range для видео на iOS), WebSocket `/ws`, `/config.json`
- `src/config.js`, `state.js`, `router.js`
- `src/screens/` idle, payment, remote, processing, success, admin, screensaver
- `src/components/` amountModal, numericPad, smile, qr
- `src/face/` detect (face-api), heuristic (запасной вариант)
- `src/lib/` ws (клиент с автопереподключением), storage, uuid
- `assets/videos/` screensaver.mp4 (заставка, один луп) и payment-bg.mp4 (фон экрана оплаты), `assets/icons/` SVG-иконки
- Маршруты: `/`, `/pay`, `/processing`, `/success`, `/admin` (только через PIN), `/screensaver`, `/remote/{opId}`

## WebSocket-протокол (`/ws`, JSON)
- `{t:'hello',role:'terminal'}` — терминал получает все события оплаты
- `{t:'op:create',opId,amount}` → ответ `op:status`; сервер хранит `{opId,amount,method,status,createdAt,paidAt}` в памяти
- `{t:'op:status',opId}` → `{t:'op:status',opId,op|null}` и подписка на операцию
- `{t:'op:paid',opId,method:'qr'|'face'}` → `{t:'op:paid',opId,op}` всем подписчикам. Повторная оплата игнорируется.

## HTTPS (камера на телефоне)
`getUserMedia` работает только на `localhost` или по HTTPS. Варианты:
1. **ngrok / cloudflared** (проще всего): `ngrok http 3000` → открывайте выданный `https://…` адрес и на терминале, и на телефоне. WebSocket пойдёт по `wss` автоматически.
2. **Самоподписанный сертификат:**
   `openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=pay" -addext "subjectAltName=IP:192.168.1.50"` (подставьте свой IP). Сервер сам включит HTTPS, если есть `certs/key.pem` и `certs/cert.pem` (`HTTPS=0` отключает). Браузер попросит принять сертификат.
3. Терминал на ноутбуке открывайте как `http://localhost:3000` (камера работает), но тогда QR должен вести на адрес, доступный телефону: `PUBLIC_URL=http://192.168.1.50:3000 node server.js` (или https-адрес ngrok).

## Сценарий на двух устройствах
1. Запустите сервер. Узнайте адрес: из лога или ngrok.
2. **Устройство A (терминал):** откройте `/` (на `localhost`, либо на адресе из п.1), коснитесь экрана, введите сумму → ОК. Откроется `/pay`: терминал создал операцию на сервере (`op:create`) и показывает QR вида `<адрес>/remote/{opId}`.
3. **Устройство B (телефон, та же сеть или ngrok):** отсканируйте QR → `/remote/{opId}`. Страница шлёт `op:status` и показывает сумму, полученную с сервера (в URL суммы нет).
4. Нажмите «Оплатить» → `op:paid` на сервер → сервер рассылает событие.
5. **Устройство A:** сразу переходит `/processing` → `/success` → главный экран.

Проверка: (а) сумма на телефоне совпадает с терминалом; (б) повторное сканирование того же QR после оплаты показывает «Оплачено ✓» без возможности платить; (в) после «Назад» и новой суммы QR другой; (г) выключите Wi-Fi на терминале на пару секунд — клиент переподключится и получит статус.

## Морф улыбка → галочка
Не SMIL. Путь `d` пересчитывается в JS на каждом кадре, а таймлайн — один `requestAnimationFrame` с easeInOutCubic (без CDN и без SMIL). Работает в iOS Safari и Chrome Android.

## Ограничения
Операции на сервере хранятся в памяти (сбрасываются при перезапуске, живут 24 ч). История и статистика админки — локально в браузере терминала.
