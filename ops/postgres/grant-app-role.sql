GRANT CONNECT ON DATABASE pick_meal_well TO pick_meal_well_app;
GRANT USAGE ON SCHEMA public TO pick_meal_well_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO pick_meal_well_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO pick_meal_well_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pick_meal_well_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pick_meal_well_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pick_meal_well_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pick_meal_well_app;
