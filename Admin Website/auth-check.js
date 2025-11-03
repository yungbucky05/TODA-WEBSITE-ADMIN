/**
 * Authentication Check Module
 * This module checks if the user is authenticated and has admin privileges
 * before allowing access to any admin module.
 * 
 * Include this at the top of every admin module page.
 */

// Check authentication immediately (before page loads)
(function() {
  'use strict';
  
  /**
   * Check if user is authenticated with valid session
   * @returns {Object|null} User authentication data or null if not authenticated
   */
  function checkAuth() {
    // Try to get auth data from localStorage (remember me) or sessionStorage (current session)
    const authData = localStorage.getItem('toda_auth') || sessionStorage.getItem('toda_auth');
    
    if (!authData) {
      console.warn('⚠️ No authentication data found');
      return null;
    }
    
    try {
      const parsedAuth = JSON.parse(authData);
      
      // Validate required fields
      if (!parsedAuth.userId || !parsedAuth.userData) {
        console.warn('⚠️ Invalid authentication data structure');
        return null;
      }
      
      // Check if session is still valid (24 hours)
      const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const sessionAge = Date.now() - (parsedAuth.timestamp || 0);
      
      if (sessionAge > sessionDuration) {
        console.warn('⚠️ Session expired');
        // Clear expired session
        localStorage.removeItem('toda_auth');
        sessionStorage.removeItem('toda_auth');
        return null;
      }
      
      // Check if user is admin
      const userType = parsedAuth.userData?.userType || parsedAuth.userType;
      if (userType !== 'ADMIN' && userType !== 'admin') {
        console.warn('⚠️ User is not an admin:', userType);
        return null;
      }
      
      // Check if user is active
      const isActive = parsedAuth.userData?.isActive;
      if (isActive === false) {
        console.warn('⚠️ User account is inactive');
        return null;
      }
      
      console.log('✅ Authentication valid for:', parsedAuth.userData?.name || 'Admin');
      return parsedAuth;
      
    } catch (error) {
      console.error('❌ Error parsing authentication data:', error);
      // Clear invalid auth data
      localStorage.removeItem('toda_auth');
      sessionStorage.removeItem('toda_auth');
      return null;
    }
  }
  
  /**
   * Redirect to login page with return URL
   */
  function redirectToLogin() {
    // Store the current page URL so we can redirect back after login
    const currentPage = window.location.pathname + window.location.search;
    sessionStorage.setItem('returnUrl', currentPage);
    
    // Show brief message before redirect
    console.warn('🔒 Access denied - Redirecting to login page...');
    
    // Redirect to login page
    // Calculate the correct path to login.html based on current location
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const prefix = depth > 1 ? '../' : '';
    window.location.href = prefix + 'login.html';
  }
  
  /**
   * Main authentication check
   * Runs immediately when this script is loaded
   */
  function enforceAuthentication() {
    // Skip auth check on login and register pages
    const currentPath = window.location.pathname.toLowerCase();
    const publicPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'];
    const isPublicPage = publicPages.some(page => currentPath.includes(page.toLowerCase()));
    
    if (isPublicPage) {
      console.log('ℹ️ Public page - skipping auth check');
      return;
    }
    
    // Check authentication
    const auth = checkAuth();
    
    if (!auth) {
      // User is not authenticated or session is invalid
      redirectToLogin();
      return;
    }
    
    // User is authenticated and authorized
    console.log('✅ Access granted to admin module');
  }
  
  // Run authentication check immediately
  enforceAuthentication();
  
  // Export functions for use in other modules
  window.AdminAuth = {
    checkAuth: checkAuth,
    redirectToLogin: redirectToLogin,
    
    /**
     * Get current authenticated user data
     * @returns {Object|null} User data or null
     */
    getCurrentUser: function() {
      const auth = checkAuth();
      return auth ? auth.userData : null;
    },
    
    /**
     * Get current user ID
     * @returns {string|null} User ID or null
     */
    getUserId: function() {
      const auth = checkAuth();
      return auth ? auth.userId : null;
    },
    
    /**
     * Logout current user
     */
    logout: function() {
      // Clear all auth data
      localStorage.removeItem('toda_auth');
      sessionStorage.removeItem('toda_auth');
      
      // Set logout flag for notification
      sessionStorage.setItem('justLoggedOut', 'true');
      
      // Redirect to login
      redirectToLogin();
    }
  };
  
})();
