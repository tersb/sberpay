// Точка входа: регистрирует экраны и запускает роутер.
import {register,start} from './src/router.js';
import idle from './src/screens/idle.js';
import payment from './src/screens/payment.js';
import remote from './src/screens/remote.js';
import processing from './src/screens/processing.js';
import success from './src/screens/success.js';
import admin from './src/screens/admin.js';
import screensaver from './src/screens/screensaver.js';
Object.entries({idle,pay:payment,remote,processing,success,admin,screensaver}).forEach(([n,f])=>register(n,f));
start();
