// ========== MORRE STORE - محرك التنقل ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 MORRE STORE - SPA Engine loaded');
});

// دالة التنقل العمومية
window.navigateToPage = function(page) {
    if (page === 'home') {
        window.location.hash = '#home';
    } else if (page === 'wallet') {
        window.location.href = 'wallet.html';
    } else if (page === 'orders') {
        window.location.href = 'orders.html';
    } else if (page === 'support') {
        window.location.href = 'support.html';
    } else if (page === 'account') {
        window.location.href = 'account.html';
    } else {
        window.location.hash = '#' + page;
    }
};

// دوال مختصرة
window.goHome = function() { window.location.hash = '#home'; };
window.goWallet = function() { window.location.href = 'wallet.html'; };
window.goOrders = function() { window.location.href = 'orders.html'; };
window.goSupport = function() { window.location.href = 'support.html'; };
window.goAccount = function() { window.location.href = 'account.html'; };
