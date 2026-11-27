-- Create and confirm these fictional users using the Supabase Auth dashboard first.
insert into examroom.profiles (id, name, role)
select users.id, demo.name, demo.role
from auth.users
join (values
  ('admin@examroom.example', 'Administrator', 'administrator'),
  ('examiner@examroom.example', 'Samira Khan', 'examiner'),
  ('candidate@examroom.example', 'Ayaan Malik', 'candidate'),
  ('visitor@examroom.example', 'Zoya Ahmed', 'candidate')
) as demo(email, name, role) on demo.email = users.email
on conflict (id) do update set name = excluded.name, role = excluded.role;
