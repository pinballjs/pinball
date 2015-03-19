FROM ubuntu:14.04.2

# java
RUN echo oracle-java8-installer shared/accepted-oracle-license-v1-1 select true | sudo /usr/bin/debconf-set-selections \
  && apt-get install -y software-properties-common \
  && add-apt-repository -y ppa:webupd8team/java \
  && apt-get update \
  && apt-get install -y oracle-java8-installer oracle-java8-set-default

# elasticsearch
RUN gpg --keyserver pool.sks-keyservers.net --recv-keys 9554F04D7259F04124DE6B476D5A82AC7E37093B DD8F2338BAE7501E3DD5AC78C273792F7D83545D
RUN apt-key adv --keyserver pool.sks-keyservers.net --recv-keys 46095ACC8548582C1A2699A9D27D666CD88E42B4
ENV ELASTICSEARCH_VERSION 1.4.4
RUN echo "deb http://packages.elasticsearch.org/elasticsearch/${ELASTICSEARCH_VERSION%.*}/debian stable main" > /etc/apt/sources.list.d/elasticsearch.list
RUN apt-get update \
  && apt-get install elasticsearch=$ELASTICSEARCH_VERSION \
  && rm -rf /var/lib/apt/lists/*
COPY docker/config /usr/share/elasticsearch/config
VOLUME /usr/share/elasticsearch/data
EXPOSE 9200 9300

# iojs
ENV IOJS_VERSION 1.5.1
RUN apt-get update \
  && apt-get install -y curl \
  && curl -SLO "https://iojs.org/dist/v$IOJS_VERSION/iojs-v$IOJS_VERSION-linux-x64.tar.gz" \
  && curl -SLO "https://iojs.org/dist/v$IOJS_VERSION/SHASUMS256.txt.asc" \
  && gpg --verify SHASUMS256.txt.asc \
  && grep " iojs-v$IOJS_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
  && tar -xzf "iojs-v$IOJS_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
  && rm "iojs-v$IOJS_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc

# supervisor
RUN apt-get update \
  && apt-get install -y python-setuptools \
  && easy_install supervisor \
  && mkdir -p /etc/supervisor/conf.d
COPY docker/supervisord.conf /etc/supervisord.conf

# elasticsearch plugins
RUN /usr/share/elasticsearch/bin/plugin -i elasticsearch/marvel/latest \
  && /usr/share/elasticsearch/bin/plugin -i royrusso/elasticsearch-HQ
COPY docker/supervisor/elasticsearch.conf /etc/supervisor/conf.d/elasticsearch.conf

# kibana
WORKDIR /tmp
RUN curl -SLO https://download.elasticsearch.org/kibana/kibana/kibana-3.1.2.tar.gz \
  && mkdir -p /opt/kibana \
  && tar zxvf kibana-3.1.2.tar.gz -C /opt/kibana --strip-components=1 \
  && rm kibana-3.1.2.tar.gz \
  && apt-get update \
  && apt-get install -y nginx
COPY docker/kibana.conf /etc/kibana.conf
COPY docker/supervisor/nginx.conf /etc/supervisor/conf.d/nginx.conf
EXPOSE 9400

# redis
RUN apt-get update \
  && apt-get install -y redis-server
COPY docker/redis.conf /etc/redis/redis.conf
COPY docker/supervisor/redis.conf /etc/supervisor/conf.d/redis.conf
EXPOSE 6379

# 
RUN npm install nodemon

# copy pinball
COPY . /app

CMD ["/usr/local/bin/supervisord"]
