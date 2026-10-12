import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testIgnore:'**/ui/**',workers:1,timeout:90000,use:{baseURL:'http://127.0.0.1:5173',headless:true,actionTimeout:12000,launchOptions:{args:['--no-sandbox']},screenshot:'only-on-failure'},reporter:'list'});
