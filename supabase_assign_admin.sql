insert into public.goldleaf_super_admins(user_id) select id from auth.users where lower(email)='gengadharan28@gmail.com' on conflict do nothing;
select u.email from auth.users u join public.goldleaf_super_admins a on a.user_id=u.id where lower(u.email)='gengadharan28@gmail.com';
