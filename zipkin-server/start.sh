java -DES_INDEX_SHARDS=2 -DSTORAGE_TYPE=elasticsearch -DES_INDEX=zipkin_test2 -DES_HOSTS=http://10.201.211.146,http://10.201.211.147 -jar target/zipkin*.jar


./mvnw -DskipTests --also-make -pl zipkin-server clean install
./mvnw -DskipTests --also-make -pl clean install

mvn clean package  -Dmaven.test.skip=true
