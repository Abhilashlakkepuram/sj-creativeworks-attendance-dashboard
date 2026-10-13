# Upload storage

Chat uploads are limited to one JPG, PNG, PDF, DOC, or DOCX file per request and
10 MB per file. They are currently written to the server's local `uploads/chat`
directory and served from `/uploads`.

The directory is not durable storage on ephemeral hosts such as Render: files
can be lost when the instance restarts or is redeployed. Durable retention
requires an external object-storage provider (for example S3-compatible storage
or Cloudinary), which is outside this focused backend fix.
