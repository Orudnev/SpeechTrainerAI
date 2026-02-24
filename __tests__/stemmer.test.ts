import * as Snowball from 'snowball-stemmers';


describe("Stemmer test", () => {
    test("test1", () => {
        const stemmer = Snowball.newStemmer('russian');
        console.log(stemmer.stem('беговая'));
        console.log(stemmer.stem('бегут'));
        console.log(stemmer.stem('побегут'));
        console.log(stemmer.stem('перебегали'));
        console.log(stemmer.stem('бежали'));
        console.log(stemmer.stem('солнечных'));
        console.log(stemmer.stem('автомобилях'));
    });
});

