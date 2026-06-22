
import { describe, expect, it, beforeEach } from 'vitest';
import { buildApp } from '../server.js';
import { getUserByEmail, resetInMemoryDb } from '../auth.js';

describe('knowledge base endpoints', () => {
  beforeEach(() => {
    resetInMemoryDb();
  });

  it('allows ADMIN to create, list, and manage articles', async () => {
    const app = await buildApp();
    const adminEmail = `kb-admin-${Date.now()}@example.com`;
    const userEmail = `kb-user-${Date.now()}@example.com`;

    // Register admin and user
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'KB Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'KB User' } });

    // Login as admin and user
    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    // User cannot create an article
    const userCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/kb/articles',
      headers: { authorization: `Bearer ${userAccessToken}` },
      payload: { title: 'User Article', content: 'This should not be created.' },
    });
    expect(userCreateResponse.statusCode).toBe(403);

    // Admin can create an article
    const createArticleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/kb/articles',
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { title: 'First Article', content: 'This is the content of the first article.' },
    });
    expect(createArticleResponse.statusCode).toBe(201);
    const article = createArticleResponse.json().article;
    expect(article).toMatchObject({ title: 'First Article' });

    // Any authenticated user can list articles
    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().articles.length).toBe(0);

    // Admin can list all articles, including drafts
    const adminListResponse = await app.inject({ method: 'GET', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(adminListResponse.statusCode).toBe(200);
    expect(adminListResponse.json().articles.length).toBe(1);


    // Any authenticated user can get an article by ID
    const getResponse = await app.inject({ method: 'GET', url: `/api/v1/kb/articles/${article.id}`, headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().article).toMatchObject({ id: article.id, title: 'First Article' });

    // Admin can update an article
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/kb/articles/${article.id}`,
      headers: { authorization: `Bearer ${adminAccessToken}` },
      payload: { title: 'Updated Title' },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().article).toMatchObject({ title: 'Updated Title' });

    // Admin can delete an article
    const deleteResponse = await app.inject({ method: 'DELETE', url: `/api/v1/kb/articles/${article.id}`, headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(deleteResponse.statusCode).toBe(204);

    // The article should no longer exist
    const getAfterDeleteResponse = await app.inject({ method: 'GET', url: `/api/v1/kb/articles/${article.id}`, headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(getAfterDeleteResponse.statusCode).toBe(404);
  });

  it('allows searching articles by title and content', async () => {
    const app = await buildApp();
    const adminEmail = `kb-admin-${Date.now()}@example.com`;
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'KB Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'How to reset password', content: 'Instructions for password reset.' } });
    await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'Billing issues', content: 'How to resolve billing problems.' } });

    const searchResponse = await app.inject({ method: 'GET', url: '/api/v1/kb/articles?q=password', headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(searchResponse.statusCode).toBe(200);
    const articles = searchResponse.json().articles;
    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe('How to reset password');
  });

  it('supports categories for articles', async () => {
    const app = await buildApp();
    const adminEmail = `kb-admin-${Date.now()}@example.com`;
    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'KB Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;

    // Admin can create a category
    const categoryResponse = await app.inject({ method: 'POST', url: '/api/v1/kb/categories', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { name: 'General' } });
    expect(categoryResponse.statusCode).toBe(201);
    const category = categoryResponse.json().category;
    expect(category.name).toBe('General');

    // Admin can create an article with a category
    const articleResponse = await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'Categorized Article', content: '...', categoryId: category.id } });
    expect(articleResponse.statusCode).toBe(201);
    expect(articleResponse.json().article.categoryId).toBe(category.id);

    await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'Uncategorized Article', content: '...' } });

    // Filter articles by category
    const filteredResponse = await app.inject({ method: 'GET', url: `/api/v1/kb/articles?categoryId=${category.id}`, headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(filteredResponse.statusCode).toBe(200);
    const filteredArticles = filteredResponse.json().articles;
    expect(filteredArticles.length).toBe(1);
    expect(filteredArticles[0].title).toBe('Categorized Article');

    // List all categories
    const categoriesResponse = await app.inject({ method: 'GET', url: '/api/v1/kb/categories', headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(categoriesResponse.statusCode).toBe(200);
    expect(categoriesResponse.json().categories.length).toBe(1);
  });

  it('handles article status (draft/published)', async () => {
    const app = await buildApp();
    const adminEmail = `kb-admin-${Date.now()}@example.com`;
    const userEmail = `kb-user-${Date.now()}@example.com`;

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'KB Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'KB User' } });

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;
    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    const articleResponse = await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'Draft Article', content: '...' } });
    const article = articleResponse.json().article;
    expect(article.status).toBe('DRAFT');

    const userListResponse = await app.inject({ method: 'GET', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(userListResponse.json().articles.length).toBe(0);

    await app.inject({ method: 'PUT', url: `/api/v1/kb/articles/${article.id}`, headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { status: 'PUBLISHED' } });

    const userListAfterPublish = await app.inject({ method: 'GET', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(userListAfterPublish.json().articles.length).toBe(1);
  });

  it('handles article feedback', async () => {
    const app = await buildApp();
    const adminEmail = `kb-admin-${Date.now()}@example.com`;
    const userEmail = `kb-user-${Date.now()}@example.com`;

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: adminEmail, password: 'Password123!', name: 'KB Admin' } });
    const admin = getUserByEmail(adminEmail);
    if (admin) admin.role = 'ADMIN';

    await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: userEmail, password: 'Password123!', name: 'KB User' } });

    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: 'Password123!' } });
    const adminAccessToken = adminLogin.json().accessToken;
    const userLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: userEmail, password: 'Password123!' } });
    const userAccessToken = userLogin.json().accessToken;

    const articleResponse = await app.inject({ method: 'POST', url: '/api/v1/kb/articles', headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { title: 'Test Article', content: '...' } });
    const article = articleResponse.json().article;

    await app.inject({ method: 'PUT', url: `/api/v1/kb/articles/${article.id}`, headers: { authorization: `Bearer ${adminAccessToken}` }, payload: { status: 'PUBLISHED' } });

    const feedbackResponse = await app.inject({ method: 'POST', url: `/api/v1/kb/articles/${article.id}/feedback`, headers: { authorization: `Bearer ${userAccessToken}` }, payload: { vote: 'HELPFUL' } });
    expect(feedbackResponse.statusCode).toBe(201);
    expect(feedbackResponse.json().feedback.vote).toBe('HELPFUL');

    const userFeedbackResponse = await app.inject({ method: 'GET', url: `/api/v1/kb/articles/${article.id}/feedback`, headers: { authorization: `Bearer ${userAccessToken}` } });
    expect(userFeedbackResponse.statusCode).toBe(403);

    const adminFeedbackResponse = await app.inject({ method: 'GET', url: `/api/v1/kb/articles/${article.id}/feedback`, headers: { authorization: `Bearer ${adminAccessToken}` } });
    expect(adminFeedbackResponse.statusCode).toBe(200);
    expect(adminFeedbackResponse.json().feedbacks.length).toBe(1);
    expect(adminFeedbackResponse.json().feedbacks[0].vote).toBe('HELPFUL');
  });
});
