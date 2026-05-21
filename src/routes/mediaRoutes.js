const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const mediaController = require('../controllers/mediaController');

router.post('/upload', upload.array('images'), mediaController.uploadMedia);
router.get('/images', mediaController.getMediaList);
router.delete('/images/:name', mediaController.deleteMedia);
router.put('/images/:name', upload.single('newImage'), mediaController.updateMedia);
router.post('/images/:name/like', mediaController.likeMedia);
router.post('/images/:name/comment', mediaController.commentMedia);

module.exports = router;
