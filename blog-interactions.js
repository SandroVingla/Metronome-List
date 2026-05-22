(function() {
    var FIREBASE_CONFIG = window.METRONOME_FIREBASE_CONFIG || {
        apiKey: "AIzaSyAT-2gV4dUFJ2TKKqhD04Oml2PIWnhD1DU",
        authDomain: "metronome-list-web.firebaseapp.com",
        projectId: "metronome-list-web",
        appId: "1:6002613587:web:2f6891091f75cc71c115a6",
        storageBucket: "metronome-list-web.firebasestorage.app",
        messagingSenderId: "6002613587"
    };

    var MODERATOR_EMAILS = [
        "metronomeliststudio@gmail.com"
    ];

    var currentUser = null;
    var auth = null;
    var db = null;
    var commentsCache = [];
    var likesCache = [];
    var articleId = getArticleId();
    var articleTitle = getArticleTitle();
    var articleRef = null;
    var ui = {};

    function getArticleId() {
        var fileName = window.location.pathname.split("/").pop() || "artigo";
        return fileName.replace(/\.html$/i, "");
    }

    function getArticleTitle() {
        var titleEl = document.querySelector("header h1, .content-header h1, h1");
        return titleEl ? titleEl.textContent.trim() : "Artigo";
    }

    function ensureFirebase() {
        if (typeof firebase === "undefined") {
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        auth = firebase.auth();
        db = firebase.firestore();
        articleRef = db.collection("blogArticles").doc(articleId);
        return true;
    }

    function injectStyles() {
        if (document.getElementById("blog-interactions-styles")) {
            return;
        }

        var style = document.createElement("style");
        style.id = "blog-interactions-styles";
        style.textContent = [
            ".article-community{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(15,23,42,.08);padding:2rem;margin:2rem 0 0;}",
            ".article-community h3{margin:0;color:#1f2937;font-size:1.4rem;}",
            ".article-community p{margin:0;}",
            ".community-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:1.5rem;}",
            ".community-stats{display:flex;gap:.75rem;flex-wrap:wrap;}",
            ".community-pill{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1rem;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#334155;font-weight:600;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease,color .2s ease;}",
            ".community-pill:hover{transform:translateY(-1px);border-color:#fca5a5;}",
            ".community-pill[disabled]{opacity:.65;cursor:not-allowed;transform:none;}",
            ".community-pill.is-liked{background:#fff1f2;border-color:#fb7185;color:#be123c;}",
            ".community-heart{font-size:1.1rem;line-height:1;}",
            ".community-meta{color:#64748b;font-size:.95rem;}",
            ".community-login{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;padding:1rem 1.1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:1rem;}",
            ".community-login button,.comment-form button,.comment-delete{border:0;border-radius:999px;font-weight:700;cursor:pointer;transition:transform .2s ease,opacity .2s ease;}",
            ".community-login button:hover,.comment-form button:hover,.comment-delete:hover{transform:translateY(-1px);}",
            ".community-login button{padding:.75rem 1rem;background:#111827;color:#fff;}",
            ".community-note{padding:.9rem 1rem;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;margin-bottom:1rem;font-size:.95rem;}",
            ".comment-form{display:grid;gap:.75rem;margin-bottom:1.5rem;}",
            ".comment-form textarea{min-height:120px;resize:vertical;border:1px solid #dbe4f0;border-radius:14px;padding:1rem;font:inherit;color:#1f2937;background:#fff;}",
            ".comment-form textarea:focus{outline:none;border-color:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,.15);}",
            ".comment-form-footer{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.75rem;}",
            ".comment-form small{color:#64748b;}",
            ".comment-form button{padding:.85rem 1.2rem;background:#ef4444;color:#fff;}",
            ".comments-list{display:grid;gap:1rem;}",
            ".comment-card{padding:1rem 1.1rem;border:1px solid #e2e8f0;border-radius:14px;background:#fff;}",
            ".comment-card-header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;margin-bottom:.65rem;}",
            ".comment-author{display:flex;gap:.85rem;align-items:center;min-width:0;}",
            ".comment-avatar{width:42px;height:42px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:700;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;flex:none;}",
            ".comment-avatar img{width:100%;height:100%;object-fit:cover;display:block;}",
            ".comment-author strong{display:block;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}",
            ".comment-author span{display:block;color:#64748b;font-size:.9rem;}",
            ".comment-body{white-space:pre-wrap;word-break:break-word;color:#334155;}",
            ".comment-delete{padding:.5rem .85rem;background:#fee2e2;color:#b91c1c;}",
            ".comment-badge{display:inline-flex;align-items:center;padding:.2rem .55rem;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.78rem;font-weight:700;margin-left:.45rem;}",
            ".comment-empty{padding:1.25rem;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;text-align:center;background:#f8fafc;}",
            ".comment-error{padding:.9rem 1rem;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;color:#be123c;margin-bottom:1rem;}",
            "@media (max-width: 768px){.article-community{padding:1.35rem;}.community-toolbar{align-items:stretch;}.community-stats{width:100%;}.community-pill{justify-content:center;flex:1;}.comment-card-header{flex-direction:column;}.comment-author strong{max-width:none;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getInitials(name) {
        var safeName = String(name || "U").trim();
        if (!safeName) return "U";
        return safeName.split(/\s+/).slice(0, 2).map(function(part) {
            return part.charAt(0);
        }).join("").toUpperCase();
    }

    function formatDate(timestamp) {
        if (!timestamp) return "agora";
        var date = typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date);
    }

    function isModerator(user) {
        if (!user || !user.email) return false;
        return MODERATOR_EMAILS.indexOf(user.email.toLowerCase()) !== -1;
    }

    function canDeleteComment(data) {
        if (!currentUser) return false;
        if (isModerator(currentUser)) return true;
        return data.authorUid && currentUser.uid === data.authorUid;
    }

    function renderShell() {
        var article = document.querySelector("article");
        if (!article) return false;

        var section = document.createElement("section");
        section.className = "article-community";
        section.innerHTML = [
            "<div class=\"community-toolbar\">",
            "  <div>",
            "    <h3>Comentarios do artigo</h3>",
            "    <p class=\"community-meta\">Curta com coracao e acompanhe a conversa deste conteudo.</p>",
            "  </div>",
            "  <div class=\"community-stats\">",
            "    <button class=\"community-pill\" type=\"button\" id=\"communityLikeButton\">",
            "      <span class=\"community-heart\" aria-hidden=\"true\">♡</span>",
            "      <span>Curtir</span>",
            "      <span id=\"communityLikeCount\">0</span>",
            "    </button>",
            "    <div class=\"community-pill\" aria-live=\"polite\">",
            "      <span aria-hidden=\"true\">💬</span>",
            "      <span>Comentarios</span>",
            "      <span id=\"communityCommentCount\">0</span>",
            "    </div>",
            "  </div>",
            "</div>",
            "<div id=\"communityError\" class=\"comment-error\" hidden></div>",
            "<div id=\"communityAuthBox\"></div>",
            "<div class=\"community-note\">Voce pode remover seus proprios comentarios. A conta moderadora tambem pode apagar mensagens ofensivas.</div>",
            "<form class=\"comment-form\" id=\"commentForm\">",
            "  <textarea id=\"commentText\" maxlength=\"800\" placeholder=\"Escreva seu comentario sobre este artigo...\"></textarea>",
            "  <div class=\"comment-form-footer\">",
            "    <small id=\"commentHelper\">Entre com Google para comentar.</small>",
            "    <button type=\"submit\" id=\"commentSubmitButton\">Publicar comentario</button>",
            "  </div>",
            "</form>",
            "<div class=\"comments-list\" id=\"commentsList\">",
            "  <div class=\"comment-empty\">Carregando comentarios...</div>",
            "</div>"
        ].join("");

        article.appendChild(section);

        ui.section = section;
        ui.likeButton = section.querySelector("#communityLikeButton");
        ui.likeCount = section.querySelector("#communityLikeCount");
        ui.commentCount = section.querySelector("#communityCommentCount");
        ui.errorBox = section.querySelector("#communityError");
        ui.authBox = section.querySelector("#communityAuthBox");
        ui.commentForm = section.querySelector("#commentForm");
        ui.commentText = section.querySelector("#commentText");
        ui.commentHelper = section.querySelector("#commentHelper");
        ui.commentSubmitButton = section.querySelector("#commentSubmitButton");
        ui.commentsList = section.querySelector("#commentsList");
        return true;
    }

    function showError(message) {
        if (!ui.errorBox) return;
        if (!message) {
            ui.errorBox.hidden = true;
            ui.errorBox.textContent = "";
            return;
        }

        ui.errorBox.hidden = false;
        ui.errorBox.textContent = message;
    }

    function renderAuthState() {
        if (!ui.authBox) return;

        if (!currentUser) {
            ui.authBox.innerHTML = [
                "<div class=\"community-login\">",
                "  <span>Entre com sua conta Google para curtir e comentar.</span>",
                "  <button type=\"button\" id=\"communityLoginButton\">Entrar com Google</button>",
                "</div>"
            ].join("");

            var loginButton = ui.authBox.querySelector("#communityLoginButton");
            if (loginButton) {
                loginButton.addEventListener("click", signInWithGoogle);
            }

            ui.commentText.disabled = true;
            ui.commentSubmitButton.disabled = true;
            ui.commentHelper.textContent = "Entre com Google para comentar.";
            ui.likeButton.disabled = false;
            return;
        }

        var label = currentUser.displayName || currentUser.email || "Conta conectada";
        var moderatorBadge = isModerator(currentUser)
            ? "<span class=\"comment-badge\">Moderador</span>"
            : "";

        ui.authBox.innerHTML = [
            "<div class=\"community-login\">",
            "  <span>Conectado como <strong>", escapeHtml(label), "</strong>", moderatorBadge, "</span>",
            "  <button type=\"button\" id=\"communityLogoutButton\">Sair</button>",
            "</div>"
        ].join("");

        var logoutButton = ui.authBox.querySelector("#communityLogoutButton");
        if (logoutButton) {
            logoutButton.addEventListener("click", signOut);
        }

        ui.commentText.disabled = false;
        ui.commentSubmitButton.disabled = false;
        ui.commentHelper.textContent = isModerator(currentUser)
            ? "Voce esta em modo moderador e pode remover comentarios."
            : "Seu comentario sera publicado neste artigo.";
        ui.likeButton.disabled = false;
    }

    function renderLikes() {
        if (!ui.likeCount || !ui.likeButton) return;

        var liked = !!(currentUser && likesCache.some(function(likeDoc) {
            return likeDoc.id === currentUser.uid;
        }));

        ui.likeCount.textContent = String(likesCache.length);
        ui.likeButton.classList.toggle("is-liked", liked);
        ui.likeButton.querySelector(".community-heart").textContent = liked ? "♥" : "♡";
    }

    function renderComments() {
        if (!ui.commentsList || !ui.commentCount) return;

        ui.commentCount.textContent = String(commentsCache.length);

        if (!commentsCache.length) {
            ui.commentsList.innerHTML = "<div class=\"comment-empty\">Seja a primeira pessoa a comentar este artigo.</div>";
            return;
        }

        ui.commentsList.innerHTML = commentsCache.map(function(doc) {
            var data = doc.data();
            var name = data.authorName || "Leitor";
            var avatar = data.authorPhotoURL
                ? "<img src=\"" + escapeHtml(data.authorPhotoURL) + "\" alt=\"" + escapeHtml(name) + "\">"
                : escapeHtml(getInitials(name));
            var badge = isModerator({ email: data.authorEmail || "" })
                ? "<span class=\"comment-badge\">Moderador</span>"
                : "";
            var deleteButton = canDeleteComment(data)
                ? "<button class=\"comment-delete\" data-comment-id=\"" + escapeHtml(doc.id) + "\" type=\"button\">Remover</button>"
                : "";

            return [
                "<article class=\"comment-card\">",
                "  <div class=\"comment-card-header\">",
                "    <div class=\"comment-author\">",
                "      <span class=\"comment-avatar\">", avatar, "</span>",
                "      <div>",
                "        <strong>", escapeHtml(name), badge, "</strong>",
                "        <span>", escapeHtml(formatDate(data.createdAt)), "</span>",
                "      </div>",
                "    </div>",
                "    ", deleteButton,
                "  </div>",
                "  <div class=\"comment-body\">", escapeHtml(data.text || ""), "</div>",
                "</article>"
            ].join("");
        }).join("");

        Array.prototype.forEach.call(ui.commentsList.querySelectorAll(".comment-delete"), function(button) {
            button.addEventListener("click", function() {
                deleteComment(button.getAttribute("data-comment-id"));
            });
        });
    }

    function signInWithGoogle() {
        if (!auth) return Promise.resolve();
        var provider = new firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(provider).catch(function(error) {
            console.error("Google sign-in error:", error);
            showError("Nao foi possivel entrar com Google agora.");
        });
    }

    function signOut() {
        if (!auth) return Promise.resolve();
        return auth.signOut().catch(function(error) {
            console.error("Sign-out error:", error);
            showError("Nao foi possivel sair da conta agora.");
        });
    }

    function toggleLike() {
        if (!articleRef) return Promise.resolve();
        if (!currentUser) {
            return signInWithGoogle();
        }

        showError("");
        var likeRef = articleRef.collection("likes").doc(currentUser.uid);

        return likeRef.get().then(function(doc) {
            if (doc.exists) {
                return likeRef.delete();
            }

            return likeRef.set({
                articleId: articleId,
                articleTitle: articleTitle,
                authorUid: currentUser.uid,
                authorName: currentUser.displayName || currentUser.email || "Leitor",
                authorEmail: currentUser.email || "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }).catch(function(error) {
            console.error("Like error:", error);
            showError("Nao foi possivel atualizar sua curtida.");
        });
    }

    function submitComment(event) {
        event.preventDefault();
        if (!articleRef) return;

        if (!currentUser) {
            signInWithGoogle();
            return;
        }

        var text = (ui.commentText.value || "").trim();
        if (text.length < 2) {
            showError("Escreva um comentario com pelo menos 2 caracteres.");
            return;
        }

        showError("");
        ui.commentSubmitButton.disabled = true;
        ui.commentSubmitButton.textContent = "Publicando...";

        articleRef.collection("comments").add({
            articleId: articleId,
            articleTitle: articleTitle,
            text: text,
            authorUid: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email || "Leitor",
            authorEmail: currentUser.email || "",
            authorPhotoURL: currentUser.photoURL || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function() {
            ui.commentText.value = "";
        }).catch(function(error) {
            console.error("Comment error:", error);
            showError("Nao foi possivel publicar o comentario.");
        }).finally(function() {
            ui.commentSubmitButton.disabled = false;
            ui.commentSubmitButton.textContent = "Publicar comentario";
        });
    }

    function deleteComment(commentId) {
        if (!articleRef || !commentId) return;

        var commentDoc = commentsCache.find(function(doc) {
            return doc.id === commentId;
        });

        if (!commentDoc || !canDeleteComment(commentDoc.data())) {
            showError("Voce nao pode remover este comentario.");
            return;
        }

        if (!window.confirm("Remover este comentario agora?")) {
            return;
        }

        showError("");
        articleRef.collection("comments").doc(commentId).delete().catch(function(error) {
            console.error("Delete comment error:", error);
            showError("Nao foi possivel remover o comentario.");
        });
    }

    function subscribeToData() {
        auth.onAuthStateChanged(function(user) {
            currentUser = user || null;
            renderAuthState();
            renderLikes();
            renderComments();
        });

        articleRef.collection("likes").onSnapshot(function(snapshot) {
            likesCache = snapshot.docs.slice();
            renderLikes();
        }, function(error) {
            console.error("Likes snapshot error:", error);
            showError("Nao foi possivel carregar as curtidas.");
        });

        articleRef.collection("comments").orderBy("createdAt", "desc").onSnapshot(function(snapshot) {
            commentsCache = snapshot.docs.slice();
            renderComments();
        }, function(error) {
            console.error("Comments snapshot error:", error);
            showError("Nao foi possivel carregar os comentarios.");
            if (ui.commentsList) {
                ui.commentsList.innerHTML = "<div class=\"comment-empty\">Os comentarios estao indisponiveis no momento.</div>";
            }
        });
    }

    function init() {
        injectStyles();
        if (!renderShell()) return;

        ui.likeButton.addEventListener("click", toggleLike);
        ui.commentForm.addEventListener("submit", submitComment);

        if (!ensureFirebase()) {
            ui.likeButton.disabled = true;
            ui.commentText.disabled = true;
            ui.commentSubmitButton.disabled = true;
            ui.commentsList.innerHTML = "<div class=\"comment-empty\">Ative o Firebase nesta pagina para usar curtidas e comentarios.</div>";
            showError("Firebase nao foi carregado nesta pagina.");
            return;
        }

        renderAuthState();
        renderLikes();
        subscribeToData();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
