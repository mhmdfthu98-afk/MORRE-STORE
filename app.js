// ============================================================
//  MORRE STORE - محرك التنقل السلس (SPA) v2.0
//  أداء عالي - انتقالات 120FPS - تحميل مسبق
// ============================================================

class AppNavigator {
    constructor() {
        // الحالة الأساسية
        this.pages = {};
        this.currentPage = 'home';
        this.isTransitioning = false;
        this.pageCache = new Map();
        this.prefetchQueue = [];
        this.isPreloading = false;
        this.rippleElements = new Set();
        
        // تهيئة النظام
        this.init();
    }

    // ============================================================
    //  التهيئة
    // ============================================================
    init() {
        // تسجيل الصفحات
        this.registerPages();
        
        // مراقبة تغيير الرابط
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.navigateTo(e.state.page, false);
            }
        });

        // تحميل مسبق للصفحات
        this.prefetchAll();
        
        // بدء مراقبة الأداء
        this.startPerformanceObserver();
        
        // إضافة تأثير Ripple للأزرار
        this.initRippleEffect();
        
        console.log('🚀 MORRE STORE - SPA Navigator initialized');
    }

    // ============================================================
    //  تسجيل الصفحات
    // ============================================================
    registerPages() {
        // البحث عن الصفحات الموجودة في DOM
        const pageElements = {
            home: document.querySelector('#homePage'),
            wallet: document.querySelector('#page-wallet') || document.querySelector('#walletPage'),
            orders: document.querySelector('#page-orders') || document.querySelector('#ordersPage'),
            support: document.querySelector('#page-support') || document.querySelector('#supportPage'),
            account: document.querySelector('#page-account') || document.querySelector('#accountPage')
        };

        // إنشاء الصفحات غير الموجودة
        Object.keys(pageElements).forEach(key => {
            if (pageElements[key]) {
                this.pages[key] = pageElements[key];
            } else {
                this.pages[key] = this.createPageContainer(key);
            }
        });

        // إخفاء جميع الصفحات عدا الرئيسية
        Object.keys(this.pages).forEach(key => {
            const page = this.pages[key];
            if (key !== 'home') {
                page.style.display = 'none';
                page.classList.remove('active');
                page.setAttribute('aria-hidden', 'true');
            } else {
                page.setAttribute('aria-hidden', 'false');
            }
        });
    }

    // ============================================================
    //  إنشاء حاوية صفحة
    // ============================================================
    createPageContainer(name) {
        const container = document.createElement('div');
        container.id = `page-${name}`;
        container.className = 'page-container';
        container.setAttribute('role', 'tabpanel');
        container.setAttribute('aria-label', name);
        container.style.cssText = `
            display: none;
            will-change: transform, opacity;
            backface-visibility: hidden;
            transform: translateZ(0);
            position: relative;
            min-height: 300px;
        `;
        
        // سكلتون لودينغ
        container.innerHTML = `
            <div class="skeleton-loading" style="padding:16px;animation:skeletonPulse 1.2s ease-in-out infinite;">
                <div class="skeleton-header" style="height:40px;background:#e2e8f0;border-radius:12px;margin-bottom:16px;"></div>
                <div class="skeleton-line" style="height:16px;background:#e2e8f0;border-radius:8px;margin-bottom:12px;"></div>
                <div class="skeleton-line" style="height:16px;background:#e2e8f0;border-radius:8px;margin-bottom:12px;width:80%;"></div>
                <div class="skeleton-card" style="height:100px;background:#e2e8f0;border-radius:12px;margin-bottom:12px;"></div>
                <div class="skeleton-card" style="height:100px;background:#e2e8f0;border-radius:12px;margin-bottom:12px;"></div>
            </div>
            <div class="page-content" style="display:none;"></div>
        `;
        
        // إضافة إلى الـ DOM
        const main = document.querySelector('main');
        if (main) {
            main.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
        
        return container;
    }

    // ============================================================
    //  التنقل بين الصفحات (الوظيفة الرئيسية)
    // ============================================================
    async navigateTo(page, addToHistory = true) {
        // منع التنقل المتكرر أو لنفس الصفحة
        if (this.isTransitioning || this.currentPage === page) {
            return;
        }
        
        this.isTransitioning = true;
        
        // مؤشر التحميل السريع
        this.showQuickLoader();
        
        const fromPage = this.currentPage;
        const toPage = page;
        
        // التأكد من وجود الصفحة
        if (!this.pages[toPage]) {
            this.pages[toPage] = this.createPageContainer(toPage);
        }
        
        // تحميل المحتوى إذا لم يكن موجوداً
        if (!this.pageCache.has(toPage)) {
            await this.loadPageContent(toPage);
        }
        
        // تنفيذ الانتقال
        await this.transitionPages(fromPage, toPage);
        
        // تحديث الحالة
        this.currentPage = toPage;
        this.isTransitioning = false;
        
        // إضافة إلى تاريخ المتصفح
        if (addToHistory) {
            window.history.pushState({ page: toPage }, '', `#${toPage}`);
        }
        
        // تحديث التنقل النشط
        this.updateActiveNav(toPage);
        
        // تحديث عنوان الصفحة
        this.updatePageTitle(toPage);
        
        // إخفاء مؤشر التحميل
        this.hideQuickLoader();
        
        // إطلاق حدث مخصص
        this.dispatchPageEvent(toPage, 'pagechange');
    }

    // ============================================================
    //  انتقال بين صفحتين مع رسوم متحركة سلسة
    // ============================================================
    transitionPages(from, to) {
        return new Promise((resolve) => {
            const fromPage = this.pages[from];
            const toPage = this.pages[to];
            
            if (!fromPage || !toPage) {
                resolve();
                return;
            }
            
            // تحضير الصفحة القادمة للظهور
            toPage.style.display = 'block';
            toPage.style.opacity = '0';
            toPage.style.transform = 'translateY(16px) scale(0.98)';
            toPage.style.transition = 'none';
            toPage.setAttribute('aria-hidden', 'false');
            
            // إجبار الـ Layout للحصول على انتقال سلس
            void toPage.offsetHeight;
            
            // إعادة تعيين الانتقال للصفحة الحالية
            fromPage.style.transition = 'opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1)';
            fromPage.style.willChange = 'transform, opacity';
            
            // استخدام requestAnimationFrame لسلاسة 120fps
            requestAnimationFrame(() => {
                // إخفاء الصفحة الحالية
                fromPage.style.opacity = '0';
                fromPage.style.transform = 'translateY(-8px) scale(0.98)';
                
                // بعد 50ms، إظهار الصفحة الجديدة
                setTimeout(() => {
                    toPage.style.transition = 'opacity 220ms cubic-bezier(0.4, 0, 0.2, 1), transform 220ms cubic-bezier(0.4, 0, 0.2, 1)';
                    toPage.style.opacity = '1';
                    toPage.style.transform = 'translateY(0) scale(1)';
                    toPage.classList.add('active');
                    
                    // إخفاء الصفحة القديمة بعد انتهاء الانتقال
                    setTimeout(() => {
                        fromPage.style.display = 'none';
                        fromPage.classList.remove('active');
                        fromPage.setAttribute('aria-hidden', 'true');
                        resolve();
                    }, 240);
                }, 60);
            });
        });
    }

    // ============================================================
    //  تحميل محتوى الصفحة
    // ============================================================
    async loadPageContent(page) {
        if (this.pageCache.has(page)) {
            return this.pageCache.get(page);
        }
        
        try {
            // محاولة جلب المحتوى من الخادم
            const content = await this.fetchPageData(page);
            this.pageCache.set(page, content);
            this.renderPageContent(page, content);
            return content;
        } catch (error) {
            console.warn('⚠️ Error loading page:', page, error);
            // إرجاع محتوى احتياطي
            const fallback = { loaded: true, page: page, fallback: true };
            this.pageCache.set(page, fallback);
            return fallback;
        }
    }

    // ============================================================
    //  جلب بيانات الصفحة
    // ============================================================
    fetchPageData(page) {
        return new Promise((resolve) => {
            // محاولة جلب الصفحة الفعلية
            const pageMap = {
                'wallet': 'wallet.html',
                'orders': 'orders.html',
                'support': 'support.html',
                'account': 'account.html'
            };
            
            const url = pageMap[page];
            if (url) {
                fetch(url)
                    .then(response => response.text())
                    .then(html => {
                        resolve({ loaded: true, page: page, html: html });
                    })
                    .catch(() => {
                        // في حال الفشل، استخدم المحتوى المحلي
                        resolve({ loaded: true, page: page, local: true });
                    });
            } else {
                // صفحات محلية (مثل home)
                resolve({ loaded: true, page: page, local: true });
            }
        });
    }

    // ============================================================
    //  عرض محتوى الصفحة
    // ============================================================
    renderPageContent(page, content) {
        const container = this.pages[page];
        if (!container) return;
        
        // إخفاء السكلتون
        const skeleton = container.querySelector('.skeleton-loading');
        if (skeleton) skeleton.style.display = 'none';
        
        // عرض المحتوى
        const contentDiv = container.querySelector('.page-content');
        if (contentDiv) {
            contentDiv.style.display = 'block';
            
            // إذا كان هناك HTML من الخادم، استخدمه
            if (content.html) {
                // استخراج المحتوى الداخلي فقط
                const parser = new DOMParser();
                const doc = parser.parseFromString(content.html, 'text/html');
                const mainContent = doc.querySelector('main .container') || doc.querySelector('.container') || doc.body;
                contentDiv.innerHTML = mainContent.innerHTML;
            }
        }
    }

    // ============================================================
    //  تحميل مسبق للصفحات
    // ============================================================
    prefetchAll() {
        const pages = ['wallet', 'orders', 'support', 'account'];
        
        pages.forEach((page, index) => {
            setTimeout(() => {
                this.prefetchPage(page);
            }, 150 + (index * 100));
        });
    }

    prefetchPage(page) {
        if (this.pageCache.has(page)) return;
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.loadPageContent(page);
            }, { timeout: 800 });
        } else {
            setTimeout(() => {
                this.loadPageContent(page);
            }, 300);
        }
    }

    // ============================================================
    //  مؤشر التحميل السريع (شريط صغير في الأعلى)
    // ============================================================
    showQuickLoader() {
        const loader = document.getElementById('quickLoader') || this.createQuickLoader();
        loader.style.opacity = '1';
        loader.style.transform = 'scaleX(1)';
        loader.style.transition = 'transform 120ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms cubic-bezier(0.4, 0, 0.2, 1)';
    }

    hideQuickLoader() {
        const loader = document.getElementById('quickLoader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transform = 'scaleX(0)';
        }
    }

    createQuickLoader() {
        const loader = document.createElement('div');
        loader.id = 'quickLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 2.5px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            z-index: 999999;
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 120ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            will-change: transform, opacity;
            border-radius: 0 2px 2px 0;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
        `;
        document.body.appendChild(loader);
        return loader;
    }

    // ============================================================
    //  تحديث التنقل النشط
    // ============================================================
    updateActiveNav(page) {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item, .sidebar .nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            const navPage = item.dataset.page || 
                           item.id?.replace('nav-', '') || 
                           item.getAttribute('href')?.replace('#', '');
            
            if (navPage === page) {
                item.classList.add('active');
                item.setAttribute('aria-selected', 'true');
            } else {
                item.setAttribute('aria-selected', 'false');
            }
        });
    }

    // ============================================================
    //  تحديث عنوان الصفحة
    // ============================================================
    updatePageTitle(page) {
        const titles = {
            'home': 'MORRE STORE | متجر الخدمات الرقمية',
            'wallet': 'MORRE STORE | محفظتي',
            'orders': 'MORRE STORE | طلباتي',
            'support': 'MORRE STORE | مركز الدعم',
            'account': 'MORRE STORE | حسابي'
        };
        document.title = titles[page] || 'MORRE STORE';
    }

    // ============================================================
    //  إطلاق أحداث مخصصة
    // ============================================================
    dispatchPageEvent(page, eventName) {
        const event = new CustomEvent(eventName, {
            detail: { page: page, previous: this.currentPage }
        });
        document.dispatchEvent(event);
    }

    // ============================================================
    //  مراقب الأداء
    // ============================================================
    startPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            try {
                // مراقبة زمن الاستجابة
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) {
                            // تسجيل العمليات البطيئة للتحليل
                            console.debug('⏱️ Slow operation:', entry.name, entry.duration + 'ms');
                        }
                    }
                });
                observer.observe({ entryTypes: ['measure', 'navigation', 'paint', 'layout-shift'] });
            } catch (e) {
                // تجاهل
            }
        }
    }

    // ============================================================
    //  تأثير Ripple للأزرار
    // ============================================================
    initRippleEffect() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.nav-item, .btn-ripple, .pm-item, .q-btn, .tab-btn');
            if (!target) return;
            
            // إنشاء تأثير الـ Ripple
            const ripple = document.createElement('span');
            ripple.className = 'ripple-effect';
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                top: ${y}px;
                left: ${x}px;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: rgba(217, 119, 6, 0.2);
                transform: scale(0);
                animation: rippleAnim 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
                pointer-events: none;
                z-index: 10;
            `;
            
            target.style.position = 'relative';
            target.style.overflow = 'hidden';
            target.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 450);
        });
    }
}

// ============================================================
//  إضافة أنماط الـ Ripple
// ============================================================
const rippleStyles = document.createElement('style');
rippleStyles.textContent = `
    @keyframes rippleAnim {
        0% { transform: scale(0); opacity: 0.6; }
        100% { transform: scale(2.5); opacity: 0; }
    }
    
    @keyframes skeletonPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    /* دعم 120Hz */
    @media (prefers-reduced-motion: no-preference) and (update: fast) {
        .page-container {
            transition-duration: 150ms !important;
        }
        .nav-item:active {
            transform: scale(0.92);
            transition: transform 50ms cubic-bezier(0.4, 0, 0.2, 1);
        }
    }
    
    /* تحسين الوضع الليلي للسكلتون */
    .dark .skeleton-header,
    .dark .skeleton-line,
    .dark .skeleton-card {
        background: #334155;
    }
    
    /* تسريع التفاعل مع اللمس */
    .nav-item, .tab-btn, .q-btn, .pm-item {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }
`;
document.head.appendChild(rippleStyles);

// ============================================================
//  تهيئة النظام
// ============================================================
let app;

// انتظار تحميل الـ DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new AppNavigator();
        window.__app = app;
    });
} else {
    app = new AppNavigator();
    window.__app = app;
}

// ============================================================
//  دوال عمومية للاستخدام من أي مكان
// ============================================================
window.navigateToPage = function(page) {
    if (app) {
        app.navigateTo(page);
    } else {
        console.warn('⚠️ App not initialized, redirecting to:', page);
        window.location.hash = page;
    }
};

window.goHome = function() {
    window.navigateToPage('home');
};

window.goWallet = function() {
    window.navigateToPage('wallet');
};

window.goOrders = function() {
    window.navigateToPage('orders');
};

window.goSupport = function() {
    window.navigateToPage('support');
};

window.goAccount = function() {
    window.navigateToPage('account');
};

// ============================================================
//  التعامل مع روابط # في الصفحة
// ============================================================
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
            e.preventDefault();
            const page = href.substring(1);
            if (['home', 'wallet', 'orders', 'support', 'account'].includes(page)) {
                window.navigateToPage(page);
            }
        }
    }
});

// ============================================================
//  معالجة تغيير الـ Hash
// ============================================================
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['home', 'wallet', 'orders', 'support', 'account'].includes(hash)) {
        if (app && app.currentPage !== hash) {
            app.navigateTo(hash, false);
        }
    }
});

// ============================================================
//  تحذير إذا كان المستخدم في بيئة ضعيفة الأداء
// ============================================================
if ('deviceMemory' in navigator && navigator.deviceMemory < 2) {
    document.documentElement.classList.add('low-end-device');
    // تقليل جودة الرسوم المتحركة
    const style = document.createElement('style');
    style.textContent = `
        .low-end-device .page-container {
            transition-duration: 100ms !important;
        }
        .low-end-device .nav-item:active {
            transform: none !important;
        }
        .low-end-device .ripple-effect {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ MORRE STORE - SPA Engine loaded successfully');