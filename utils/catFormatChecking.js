export default function (cat) {
    if (!cat.name) {
        cat.name = "New Cafe Cat";
    }
    if (!cat.images.length) {
        cat.images.push("https://c972d5be6d3bb1aba721.cdn6.editmysite.com/uploads/b/c972d5be6d3bb1aba7212c6919fb3035ad50bd02f14253ece5c803d30c75f9a1/TCC%20v1%20White%20Bg%201_1718382480.png?optimize=medium");
    }
    if (!cat.sex) {
        cat.sex = "Unknown";
    }
    if (!cat.date_of_birth) {
        cat.date_of_birth = "Unknown";
    }
    if (!cat.is_ok_with_other_dogs) {
        cat.is_ok_with_other_dogs = "Not Sure"
    }
    if (!cat.is_ok_with_other_cats) {
        cat.is_ok_with_other_cats = "Not Sure"
    }
    if (!cat.is_ok_with_other_kids) {
        cat.is_ok_with_other_kids = "Not Sure"
    }
    return cat;
}