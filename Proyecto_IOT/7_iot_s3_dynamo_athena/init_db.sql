CREATE TABLE IF NOT EXISTS sensor_events (
    id          SERIAL PRIMARY KEY,
    device_id   VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50)  NOT NULL,
    value       NUMERIC(10,4) NOT NULL,
    timestamp   TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_events_device_id ON sensor_events(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_events_timestamp ON sensor_events(timestamp DESC);
