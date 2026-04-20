-- Propagar datas dos user_combos (source='import') para os filhos
-- 1. user_courses a partir de combo_courses
UPDATE user_courses uc
SET purchased_at = ucb.purchased_at,
    expires_at = ucb.expires_at,
    source = 'import'
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
WHERE ucb.source = 'import'
  AND uc.user_id = ucb.user_id
  AND uc.course_id = cc.course_id
  AND (uc.source IS DISTINCT FROM 'import' OR uc.purchased_at IS DISTINCT FROM ucb.purchased_at);

-- 2. user_ebooks a partir de combo_ebooks
UPDATE user_ebooks ue
SET purchased_at = ucb.purchased_at,
    expires_at = ucb.expires_at,
    source = 'import'
FROM user_combos ucb
JOIN combo_ebooks ce ON ce.combo_id = ucb.combo_id
WHERE ucb.source = 'import'
  AND ue.user_id = ucb.user_id
  AND ue.ebook_id = ce.ebook_id
  AND (ue.source IS DISTINCT FROM 'import' OR ue.purchased_at IS DISTINCT FROM ucb.purchased_at);

-- 3. user_packages via combo_courses -> course_packages
UPDATE user_packages up
SET purchased_at = ucb.purchased_at,
    expires_at = ucb.expires_at,
    source = 'import'
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
JOIN course_packages cp ON cp.course_id = cc.course_id
WHERE ucb.source = 'import'
  AND up.user_id = ucb.user_id
  AND up.package_id = cp.package_id
  AND (up.source IS DISTINCT FROM 'import' OR up.purchased_at IS DISTINCT FROM ucb.purchased_at);

-- 4. Para usuários vitalícios (user_lifetime_access), garantir expires_at=NULL em TODOS os filhos
UPDATE user_courses uc
SET expires_at = NULL, source = 'import'
FROM user_lifetime_access ula
WHERE uc.user_id = ula.user_id AND uc.expires_at IS NOT NULL;

UPDATE user_ebooks ue
SET expires_at = NULL, source = 'import'
FROM user_lifetime_access ula
WHERE ue.user_id = ula.user_id AND ue.expires_at IS NOT NULL;

UPDATE user_packages up
SET expires_at = NULL, source = 'import'
FROM user_lifetime_access ula
WHERE up.user_id = ula.user_id AND up.expires_at IS NOT NULL;

UPDATE user_combos ucb
SET expires_at = NULL, source = 'import'
FROM user_lifetime_access ula
WHERE ucb.user_id = ula.user_id AND ucb.expires_at IS NOT NULL;