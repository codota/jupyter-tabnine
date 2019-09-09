FROM python:3.7-alpine3.10

ENV TABNINE_BINARY_PATH=/usr/local/tabnine/binary/TabNine
RUN TAB_LINE_VERSION=$(wget -qO- https://update.tabnine.com/version) \
    && mkdir -p /usr/local/tabnine/binary \
    && wget -O ${TABNINE_BINARY_PATH} \
        https://update.tabnine.com/${TAB_LINE_VERSION}/x86_64-unknown-linux-gnu/TabNine \
        && chmod 777 ${TABNINE_BINARY_PATH}

COPY server/server /usr/local/bin/server
RUN chmod 777 /usr/local/bin/server
ENV SERVER_PORT 8080
EXPOSE 8080
EXPOSE 5555
ENTRYPOINT ["/usr/local/bin/server"]
