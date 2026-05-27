const http = require('http');

const routes = ['/', '/minigame', '/login', '/admin-news'];

async function testRoute(route) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000${route}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(`Route ${route} failed with status code ${res.statusCode}`);
                }
                if (!data.includes('Beo') || !data.includes('Hub')) {
                    reject(`Route ${route} failed: "Beo" or "Hub" not found in response`);
                }
                if (route !== '/login' && route !== '/admin-news' && !data.includes('nav-tab')) {
                    reject(`Route ${route} failed: "nav-tab" not found in response`);
                }
                console.log(`[PASS] Route ${route} responded correctly (${data.length} bytes)`);
                resolve();
            });
        }).on('error', (err) => {
            reject(`Route ${route} failed with error: ${err.message}`);
        });
    });
}

async function runTests() {
    try {
        console.log('Bắt đầu tự động test EJS endpoints...');
        for (const route of routes) {
            await testRoute(route);
        }
        console.log('Tất cả các route đều hoạt động tốt!');
    } catch (err) {
        console.error('[FAIL] Lỗi kiểm thử:', err);
    }
}

runTests();
