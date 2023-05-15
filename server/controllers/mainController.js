exports.sendHomePage = (req, res) => {
    const userAuthentication = req.session.auth;
    if (userAuthentication) {
        const username = req.session.username;
        const userColor = req.session.userColor;
        const userPoints = req.session.userPoints;
        const userWins = req.session.userWins;
        rgbaUserColor = hexToRGBA(userColor, 0.5);
        res.render('pages/index', { userAuthentication, username, userColor, userPoints, userWins, rgbaUserColor });
    } else {
        res.render('pages/index', { userAuthentication });
    }
};

function hexToRGBA(hex, alpha) {
    const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));
    return `rgba(${r},${g},${b},${alpha})`;
}