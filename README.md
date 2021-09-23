# projet node convert csv to pg -> format data etc
### clone the project 
```sudo git clone "https://github.com/CinquinAndy/klee_csv_formater_to_pg.git"```
### create database and user 
````
su - root 
su - postgres 

psql CREATE DATABASE GRAFANADATA OWNER kleeGrafanaData; 
CREATE USER kleeGrafanaData WITH PASSWORD 'password'; 

su - root 
su - andy 
cd ~
````
### create .env for the project

````
sudo vim /klee_csv_formater_to_pg/.env  
cd klee_csv_formater_to_pg  
sudo npm install  
cd ../  
````

------------------------------------------------------

#### exemple for the .env

````
HOST= localhost
USER= postgres
DATABASE= testdb
PASSWORD= 123
PORT= 5432
````

------------------------------------------------------

## We need to config an access to pgsql

````
sudo vim /etc/postgresql/12/main/postgresql.conf
````

#### modify the following line in the postgresql.conf file

````
listen_addresses = '*'
````

````
sudo vim /etc/postgresql/12/main/pg_hba.conf
````

#### add the following lines in pg_hba.conf file

```
# TYPE DATABASE USER CIDR-ADDRESS  METHOD
host  all  all 0.0.0.0/0 md5
```
