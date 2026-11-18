import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.js',workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:4188',headless:true},
 projects:[{name:'chrome',use:{browserName:'chromium',...(process.env.CI?{}:{channel:'chrome'})}},{name:'webkit',use:{browserName:'webkit'}}],
 webServer:{command:'PORT=4188 node server.js',url:'http://127.0.0.1:4188',reuseExistingServer:false},outputDir:'test-results'
});
