// nav-auth.js — botão de conta compartilhado para todas as páginas secundárias

(function() {
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyAT-2gV4dUFJ2TKKqhD04Oml2PIWnhD1DU",
        authDomain: "metronome-list-web.firebaseapp.com",
        projectId: "metronome-list-web",
        appId: "1:6002613587:web:2f6891091f75cc71c115a6",
        storageBucket: "metronome-list-web.firebasestorage.app",
        messagingSenderId: "6002613587"
    };

    function injectNavAccount() {
        const navContainer = document.querySelector('.nav-container');
        if (!navContainer) return;

        // Mover o nav-toggle para dentro do nav-actions
        const existingToggle = navContainer.querySelector('.nav-toggle');

        const navActions = document.createElement('div');
        navActions.className = 'nav-actions';
        navActions.innerHTML = `
            <div class="account-menu">
                <button class="nav-account-btn" id="accountMenuButton" onclick="toggleNavAccountMenu()" type="button" aria-expanded="false">
                    <span class="nav-account-avatar" id="accountAvatar">ML</span>
                    <span class="nav-account-copy">
                        <strong id="accountButtonLabel">Minha Conta</strong>
                        <small id="accountButtonStatus">Login com Google</small>
                    </span>
                </button>
                <div class="account-dropdown" id="accountDropdown">
                    <div class="account-dropdown-header">
                        <span class="account-sync-badge" id="accountSyncBadge">Local</span>
                        <strong id="accountPanelTitle">Cadastro e login com Google</strong>
                        <p id="accountPanelSubtitle">Entre para salvar seus setlists na nuvem e acessar em qualquer dispositivo.</p>
                    </div>
                    <div class="account-user" id="accountUserInfo" hidden>
                        <span class="account-user-avatar" id="accountUserAvatar">ML</span>
                        <div>
                            <strong id="accountUserName">Visitante</strong>
                            <small id="accountUserEmail"></small>
                        </div>
                    </div>
                    <div class="account-dropdown-actions">
                        <button class="account-primary-btn" id="accountLoginButton" onclick="navSignInWithGoogle()" type="button">Entrar com Google</button>
                        <button class="account-secondary-btn" id="accountLogoutButton" onclick="navSignOut()" type="button" hidden>Sair</button>
                    </div>
                    <p class="account-dropdown-note" id="accountDropdownNote">Sem login, os setlists continuam salvos só no navegador atual.</p>
                </div>
            </div>
        `;

        if (existingToggle) {
            navActions.appendChild(existingToggle);
            existingToggle.remove();
        }

        navContainer.appendChild(navActions);

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', function(e) {
            const menu = document.querySelector('.account-menu');
            if (menu && !menu.contains(e.target)) {
                const dd = document.getElementById('accountDropdown');
                if (dd) dd.classList.remove('open');
            }
        });
    }

    window.toggleNavAccountMenu = function() {
        const dropdown = document.getElementById('accountDropdown');
        const button = document.getElementById('accountMenuButton');
        if (!dropdown || !button) return;
        const willOpen = !dropdown.classList.contains('open');
        dropdown.classList.toggle('open', willOpen);
        button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    };

    window.navSignInWithGoogle = function() {
        if (!window._navFirebaseAuth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        window._navFirebaseAuth.signInWithPopup(provider).catch(function(err) {
            console.error('Login error:', err);
        });
    };

    window.navSignOut = function() {
        if (!window._navFirebaseAuth) return;
        window._navFirebaseAuth.signOut();
    };

    function updateUI(user) {
        const avatar = document.getElementById('accountAvatar');
        const label = document.getElementById('accountButtonLabel');
        const status = document.getElementById('accountButtonStatus');
        const badge = document.getElementById('accountSyncBadge');
        const userInfo = document.getElementById('accountUserInfo');
        const userAvatar = document.getElementById('accountUserAvatar');
        const userName = document.getElementById('accountUserName');
        const userEmail = document.getElementById('accountUserEmail');
        const loginBtn = document.getElementById('accountLoginButton');
        const logoutBtn = document.getElementById('accountLogoutButton');
        const note = document.getElementById('accountDropdownNote');
        const panelTitle = document.getElementById('accountPanelTitle');
        const panelSubtitle = document.getElementById('accountPanelSubtitle');

        if (user) {
            const initials = (user.displayName || user.email || 'U')
                .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            if (avatar) avatar.textContent = initials;
            if (user.photoURL && avatar) {
                avatar.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName}">`;
            }
            if (label) label.textContent = (user.displayName || user.email || '').split(' ')[0];
            if (status) status.textContent = 'Google conectado';
            if (badge) { badge.textContent = 'NUVEM'; badge.className = 'account-sync-badge cloud'; }
            if (userInfo) userInfo.hidden = false;
            if (userAvatar) {
                userAvatar.textContent = initials;
                if (user.photoURL) userAvatar.innerHTML = `<img src="${user.photoURL}" alt="">`;
            }
            if (userName) userName.textContent = user.displayName || user.email;
            if (userEmail) userEmail.textContent = user.email;
            if (loginBtn) loginBtn.hidden = true;
            if (logoutBtn) logoutBtn.hidden = false;
            if (note) note.textContent = 'Seus setlists novos passam a ser salvos automaticamente na nuvem.';
            if (panelTitle) panelTitle.textContent = 'Minha Conta';
            if (panelSubtitle) panelSubtitle.textContent = 'Seus setlists estão sincronizados.';
        } else {
            if (avatar) avatar.textContent = 'ML';
            if (label) label.textContent = 'Minha Conta';
            if (status) status.textContent = 'Login com Google';
            if (badge) { badge.textContent = 'LOCAL'; badge.className = 'account-sync-badge'; }
            if (userInfo) userInfo.hidden = true;
            if (loginBtn) loginBtn.hidden = false;
            if (logoutBtn) logoutBtn.hidden = true;
            if (note) note.textContent = 'Sem login, os setlists continuam salvos só no navegador atual.';
            if (panelTitle) panelTitle.textContent = 'Cadastro e login com Google';
            if (panelSubtitle) panelSubtitle.textContent = 'Entre para salvar seus setlists na nuvem e acessar em qualquer dispositivo.';
        }
    }

    function initFirebase() {
        if (typeof firebase === 'undefined') return;

        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        window._navFirebaseAuth = firebase.auth();
        window._navFirebaseAuth.onAuthStateChanged(updateUI);
    }

    // Injeta HTML e inicia Firebase após DOM pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            injectNavAccount();
            initFirebase();
        });
    } else {
        injectNavAccount();
        initFirebase();
    }
})();