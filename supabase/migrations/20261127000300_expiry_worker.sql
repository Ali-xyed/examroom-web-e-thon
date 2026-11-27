create extension if not exists pg_cron;
select cron.schedule('uncooked-finalize-expired','* * * * *',
  'update examroom.attempts set submitted_at=deadline where submitted_at is null and deadline<=clock_timestamp()');
