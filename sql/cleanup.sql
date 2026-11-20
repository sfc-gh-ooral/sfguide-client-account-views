-- Client Account Views at App Speed: remove everything sql/setup.sql created.
-- Dropping the database removes the dynamic tables, interactive tables, views, and raw tables in it.
-- The example role owns the database and warehouses, so drop them as that role first.
USE ROLE ACCOUNTADMIN;
SET my_user = CURRENT_USER();
GRANT ROLE CAV_DEMO_ROLE TO USER IDENTIFIER($my_user);
USE ROLE CAV_DEMO_ROLE;
DROP DATABASE IF EXISTS CLIENT_VIEWS_DEMO;
DROP WAREHOUSE IF EXISTS CAV_IWH;
DROP WAREHOUSE IF EXISTS CAV_WH;
USE ROLE ACCOUNTADMIN;
DROP ROLE IF EXISTS CAV_DEMO_ROLE;

-- Confirm nothing is left (all three should return no rows).
SHOW DATABASES LIKE 'CLIENT_VIEWS_DEMO';
SHOW WAREHOUSES LIKE 'CAV_%';
SHOW ROLES LIKE 'CAV_DEMO_ROLE';
