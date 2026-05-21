const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const ideaController = require('../controllers/ideaController');

router.get('/', ideaController.getIdeas);
router.post('/', ideaController.createIdea);
router.post('/:id/like', ideaController.likeIdea);
router.post('/faceswap', upload.single('faceImage'), ideaController.swapFace);

module.exports = router;
